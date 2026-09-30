// src/controllers/checkout.controller.ts
import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { Types } from "mongoose";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import { stripe } from "../utils/stripe";
import { Event } from "../models/Event";
import {
  ensureTicketPdf,
  ticketFileName,
  ensureMergedTicketsPdf,
  mergedTicketFileName,
} from "../utils/tickets";
import { printNardeliTicket, NardeliTicketPayload } from "../utils/zebraPrinter";
import { numToLetter, tableLabelFromTableId } from "../utils/seatLabel";
import { fulfillPaidOrder } from "../utils/fulfillOrder";
import { nanoid } from "nanoid";



// ---------- Utilidades de pricing (centavos) ----------
const SERVICE_FEE_PCT = 5;

/** Cantidad de boletos de un item: por asientos (seated) o por cantidad (general). */
function itemQty(it: any): number {
  if (Array.isArray(it?.seatIds) && it.seatIds.length) return it.seatIds.length;
  const q = Number(it?.quantity);
  return Number.isFinite(q) && q > 0 ? Math.floor(q) : 0;
}

/** Precio del boleto (centavos) para eventos de admisión general. */
function generalPriceCents(eventDoc: any): number {
  const c = eventDoc?.generalAdmission?.priceCents;
  if (typeof c === "number" && c > 0) return c;
  const p = eventDoc?.generalAdmission?.price;
  if (typeof p === "number" && p > 0) return Math.round(p * 100);
  return 0;
}

/** Genera N boletos genéricos (sin asiento) para una orden de admisión general. */
function buildGeneralTickets(orderId: string, qty: number) {
  const tickets: any[] = [];
  for (let i = 0; i < qty; i++) {
    tickets.push({
      ticketId: `${orderId}-GEN-${i + 1}-${nanoid(6)}`,
      seatId: `GEN-${i + 1}`,
      tableId: "GENERAL",
      zoneId: "GENERAL",
      status: "issued",
      issuedAt: new Date(),
    });
  }
  return tickets;
}

/**
 * Cantidad de boletos ya comprometidos (vendidos o reservados) de un evento
 * de admisión general. Cuenta órdenes pagadas y pendientes de pago no expiradas.
 */
async function generalSoldQty(eventId: string): Promise<number> {
  const now = Date.now();
  const orders = await Order.find({
    eventId,
    status: { $in: ["paid", "pending_payment"] },
  })
    .select("status expiresAt items")
    .lean();

  let total = 0;
  for (const o of orders as any[]) {
    if (
      o.status === "pending_payment" &&
      o.expiresAt &&
      new Date(o.expiresAt).getTime() < now
    ) {
      continue; // reserva expirada, ya no cuenta
    }
    for (const it of o.items || []) total += itemQty(it);
  }
  return total;
}

function zonePriceCentsFromEvent(eventDoc: any, zoneId: string): number {
  const key = String(zoneId || "").toLowerCase(); // "vip" | "oro"
  const cents = eventDoc?.pricingCents?.[key];
  if (typeof cents === "number" && cents >= 0) return cents;
  // fallback a pesos si no está migrado (multiplica *100)
  const pesos = eventDoc?.pricing?.[key];
  return typeof pesos === "number" ? Math.round(pesos * 100) : 0;
}

function priceCentsForItem(eventDoc: any, it: any): number {
  // Admisión general: precio único del evento (con fallback al unitPrice del item)
  if (eventDoc?.admissionType === "general") {
    const g = generalPriceCents(eventDoc);
    if (g > 0) return g;
    const unit = Number(it?.unitPrice);
    return Number.isFinite(unit) && unit > 0 ? Math.round(unit * 100) : 0;
  }

  // 1) Intentar tomar del evento (pricingCents o pricing*100)
  const key = String(it?.zoneId || "").toLowerCase();
  const fromCents = eventDoc?.pricingCents?.[key];
  if (typeof fromCents === "number" && fromCents > 0) return fromCents;
  const fromPesos = eventDoc?.pricing?.[key];
  if (typeof fromPesos === "number" && fromPesos > 0) return Math.round(fromPesos * 100);

  // 2) Fallback: usar unitPrice del payload (pesos) * 100
  const unit = Number(it?.unitPrice);
  if (Number.isFinite(unit) && unit > 0) return Math.round(unit * 100);

  // 3) Si todo falla, 0
  return 0;
}

function computePricingCents(eventDoc: any, items: Array<any>) {
  let subtotalCents = 0;
  for (const it of items) {
    const priceCents = priceCentsForItem(eventDoc, it);
    const qty = itemQty(it);
    subtotalCents += priceCents * qty;
  }
  const feesCents = Math.round((subtotalCents * SERVICE_FEE_PCT) / 100);
  const taxCents = 0;
  const discountCents = 0;
  const totalCents = subtotalCents + feesCents + taxCents - discountCents;

  return {
    subtotalCents,
    feesCents,
    taxCents,
    discountCents,
    totalCents,
    currency: "MXN" as const,
    servicePct: SERVICE_FEE_PCT,
  };
}

// ---------- Handler: PRE-FLIGHT ----------
export const preflightCheckout = async (req: Request & { user?: any }, res: Response) => {
  try {
    console.log("🧪 PRECHECKOUT BODY");
    console.log("eventId:", req.body?.eventId);
    console.log("sessionId:", req.body?.sessionId);
    console.log("sessionDate:", req.body?.sessionDate);

    console.log("items length:", Array.isArray(req.body?.items) ? req.body.items.length : "NO ARRAY");

    if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
      const it = req.body.items[0];
      console.log("first item:", {
        zoneId: it.zoneId,
        tableId: it.tableId,
        seatIds: it.seatIds,
        unitPrice: it.unitPrice,
      });
    }
    const { eventId, items } = req.body ?? {};
    console.log("🧪 PRECHECKOUT BODY (seatLabels check)");
    console.log("eventId:", eventId);
    console.log("items length:", Array.isArray(items) ? items.length : 0);

    const first = Array.isArray(items) ? items[0] : null;
    console.log("first item keys:", first ? Object.keys(first) : null);
    console.log("first item seatIds:", first?.seatIds);
    console.log("first item seatLabels:", first?.seatLabels); // ✅ ESTE es el importante
    console.log("first item:", first);

    if (!eventId || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "bad_request", message: "eventId e items son requeridos" });
    }

    const eventDoc = await Event.findById(eventId).lean();
    if (!eventDoc)
      return res.status(404).json({ error: "not_found", message: "Evento no existe" });

    // TODO (opcional): validar que asientos no estén vendidos / retenidos por otro usuario

    const pricing = computePricingCents(eventDoc, items);

    // Admisión general: validar cupo disponible antes de mandar a pago
    if ((eventDoc as any).admissionType === "general") {
      const capacity = (eventDoc as any)?.generalAdmission?.capacity;
      if (capacity !== null && capacity !== undefined) {
        const requestedQty = items.reduce((acc: number, it: any) => acc + itemQty(it), 0);
        const sold = await generalSoldQty(String(eventDoc._id));
        const left = Math.max(0, Number(capacity) - sold);
        if (requestedQty > left) {
          return res.status(409).json({
            error: "sold_out",
            message:
              left > 0
                ? `Solo quedan ${left} boletos disponibles.`
                : "Boletos agotados para este evento.",
            available: left,
          });
        }
      }
    }

    // Si más adelante tienes holds previos, aquí devolverías holdGroupId/expiración real
    const now = Date.now();
    const expiresAt = new Date(now + 15 * 60 * 1000); // 15 min estimado

    return res.json({
      ok: true,
      pricing,
      hold: { holdGroupId: "hg_temp", expiresAt },
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "preflight_failed", message: err.message });
  }
};

/** POST /api/checkout */
export const createCheckout = async (req: Request & { user?: any }, res: Response) => {
  try {
    const {
      eventId,
      items,
      totals,
      sessionDate,
      sessionId,
      pricing: pricingFromClient,
      paymentMethod = "card",   // 🔹 viene del front
      cashPayment,              // 🔹 { amountGiven, change } cuando es efectivo
      cashCustomer,             // 🔹 { name, phone?, email? } cuando es efectivo
      holdGroupId,
    } = req.body;

    if (!eventId || !Array.isArray(items) || items.length === 0 || !sessionId) {
      return res
        .status(400)
        .json({ error: "bad_request", message: "eventId e items son requeridos" });
    }

    const eventDoc = await Event.findById(eventId).lean();
    if (!eventDoc)
      return res.status(404).json({ error: "not_found", message: "Evento no existe" });

    // Recalcula en servidor si no recibimos pricing del preflight (backward compatible)
    const pricing =
      pricingFromClient && typeof pricingFromClient.totalCents === "number"
        ? pricingFromClient
        : computePricingCents(eventDoc, items);

    const userId = req.user?.id || req.user?._id || req.user?.email || "anon";

    // 🔹 Roles para limitar pago en efectivo solo a admin/taquilla
    const roles: string[] = Array.isArray(req.user?.roles)
      ? req.user.roles
      : req.user?.role
      ? [req.user.role]
      : [];

    const isAdmin = roles.includes("admin") || roles.includes("taquilla") || roles.includes("staff");

    // Pago en efectivo SOLO para cuentas internas (admin/taquilla)
    if (paymentMethod === "cash" && !isAdmin) {
      return res.status(403).json({
        error: "forbidden",
        message: "El pago en efectivo solo puede ser registrado por cuentas de taquilla/admin.",
      });
    }

    const now = new Date();

    // Datos base comunes para cualquier método de pago
    const baseOrderData: any = {
      userId,
      eventId,
      sessionId,
      sessionDate,
      items,
      totals, // snapshot en pesos (si lo quieres conservar)
      currency: "MXN",
      totalsCents: {
        subtotal: pricing.subtotalCents,
        fees: pricing.feesCents,
        tax: pricing.taxCents,
        discount: pricing.discountCents,
        total: pricing.totalCents,
      },
      paymentMethod, // 👈 lo agregamos al modelo
      admissionType: (eventDoc as any).admissionType || "seated",
    };

    // ================================================================
    // ADMISIÓN GENERAL: venta por cantidad de boletos (sin asientos)
    // ================================================================
    if ((eventDoc as any).admissionType === "general") {
      const requestedQty = items.reduce((acc: number, it: any) => acc + itemQty(it), 0);
      if (requestedQty <= 0) {
        return res
          .status(400)
          .json({ error: "bad_request", message: "Debes elegir al menos un boleto." });
      }

      // Validar cupo (si no es ilimitado)
      const capacity = (eventDoc as any)?.generalAdmission?.capacity;
      if (capacity !== null && capacity !== undefined) {
        const sold = await generalSoldQty(eventId);
        if (sold + requestedQty > Number(capacity)) {
          const left = Math.max(0, Number(capacity) - sold);
          return res.status(409).json({
            error: "sold_out",
            message:
              left > 0
                ? `Solo quedan ${left} boletos disponibles.`
                : "Boletos agotados para este evento.",
            available: left,
          });
        }
      }

      const unitCents = priceCentsForItem(eventDoc, items[0] || {});

      // ---------- GENERAL + TARJETA / STRIPE ----------
      if (paymentMethod === "card") {
        const order = await Order.create({
          ...baseOrderData,
          status: "pending_payment",
          statusTimeline: [{ status: "pending_payment", at: now }],
        });
        const orderId: string = String(order._id as unknown as Types.ObjectId);

        const line_items: any[] = [
          {
            quantity: requestedQty,
            price_data: {
              currency: "mxn",
              unit_amount: unitCents,
              product_data: {
                name: `Boletos • ${(eventDoc as any).title || "Evento"}`,
                metadata: { eventId, admissionType: "general" },
              },
            },
          },
        ];

        if (pricing.feesCents > 0) {
          line_items.push({
            quantity: 1,
            price_data: {
              currency: "mxn",
              unit_amount: pricing.feesCents,
              product_data: {
                name: `Tarifa de servicio (${pricing.servicePct ?? 5}%)`,
                metadata: { kind: "service_fee", eventId },
              },
            },
          });
        }

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items,
          metadata: { orderId, eventId },
          success_url: `${process.env.PUBLIC_URL}/checkout/success?orderId=${orderId}&pm=card&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.PUBLIC_URL}/checkout/cancel?order=${orderId}`,
        });

        order.stripe = { checkoutSessionId: session.id };
        await order.save();

        return res.json({ checkoutUrl: session.url, orderId });
      }

      // ---------- GENERAL + EFECTIVO (SOLO ADMIN / TAQUILLA) ----------
      if (paymentMethod === "cash") {
        if (!cashCustomer?.name || !cashCustomer.name.trim()) {
          return res.status(400).json({
            error: "bad_request",
            message: "Para pago en efectivo es obligatorio el nombre del cliente.",
          });
        }

        const amountGivenNum = Number(cashPayment?.amountGiven ?? 0);
        const changeNum = Number(cashPayment?.change ?? 0);

        const order = await Order.create({
          ...baseOrderData,
          status: "paid",
          paidAt: now,
          buyer: {
            name: cashCustomer.name.trim(),
            phone: cashCustomer.phone?.trim() || undefined,
            email: cashCustomer.email?.trim() || undefined,
          },
          statusTimeline: [
            { status: "pending_payment", at: now, note: "Orden creada para pago en efectivo" },
            { status: "paid", at: now, note: "Pago en efectivo registrado en taquilla" },
          ],
          cashPayment:
            cashPayment && !Number.isNaN(amountGivenNum)
              ? {
                  amountGiven: amountGivenNum,
                  change: changeNum,
                  registeredAt: now,
                  cashierUserId: userId,
                }
              : undefined,
        });

        const orderId: string = String(order._id as unknown as Types.ObjectId);

        // Emitir N boletos genéricos de inmediato (efectivo = pagado)
        order.tickets = buildGeneralTickets(orderId, requestedQty) as any;
        await order.save();

        // Imprimir en Zebra (un boleto por entrada)
        try {
          const eventName: string =
            (eventDoc as any)?.title || (eventDoc as any)?.name || "Evento Nardeli";

          const eventDateRaw: any =
            sessionDate ||
            (eventDoc as any)?.sessions?.[0]?.date ||
            (eventDoc as any)?.date ||
            undefined;
          const dateLabel: string = eventDateRaw
            ? new Date(eventDateRaw).toLocaleString("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "-";

          const eventPlace: string =
            [(eventDoc as any)?.venue, (eventDoc as any)?.city].filter(Boolean).join(", ") || "";

          const priceLabel = new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
          }).format(pricing.totalCents / 100);

          for (let i = 0; i < requestedQty; i++) {
            const payload: NardeliTicketPayload = {
              eventName,
              dateLabel,
              eventPlace,
              orderFolio: orderId,
              zone: "GENERAL",
              tableLabel: "-",
              seatLabels: [`Boleto ${i + 1}/${requestedQty}`],
              buyerName: cashCustomer.name.trim(),
              priceLabel,
              ticketCode: `${orderId}-${i + 1}`,
            };
            await printNardeliTicket(payload);
          }
          console.log("✅ Boletos impresos en Zebra para orden general", orderId);
        } catch (printErr) {
          console.error("Error imprimiendo boletos en Zebra:", printErr);
        }

        const successUrl = `${process.env.PUBLIC_URL}/checkout/success?orderId=${orderId}`;
        return res.json({ ok: true, orderId, successUrl });
      }

      return res
        .status(400)
        .json({ error: "invalid_payment_method", message: "Método de pago inválido" });
    }

    // ----------------------------------------------------------------
    // CASO 1: TARJETA / STRIPE
    // ----------------------------------------------------------------
    if (paymentMethod === "card") {
      const order = await Order.create({
        ...baseOrderData,
        status: "pending_payment",
        statusTimeline: [{ status: "pending_payment", at: now }],
      });

      const orderId: string = String(order._id as unknown as Types.ObjectId);

      // Agrupar por zona para líneas de "entradas"
      const zoneAgg = new Map<
        string,
        { qty: number; unit_amount: number; tableNames: Set<string> }
      >();
      for (const it of items) {
        const qty = Array.isArray(it.seatIds) ? it.seatIds.length : 0;
        if (!qty) continue;

        const zoneKey = String(it.zoneId).toUpperCase(); // "VIP" | "ORO"
        const priceCents = priceCentsForItem(eventDoc, it); // <-- usa el helper con fallback

        const current =
          zoneAgg.get(zoneKey) || {
            qty: 0,
            unit_amount: priceCents,
            tableNames: new Set<string>(),
          };
        current.qty += qty;
        current.unit_amount = priceCents; // asegura el unit_amount
        current.tableNames.add(String(it.tableId));
        zoneAgg.set(zoneKey, current);
      }

      const line_items: any[] = [];

      // 1) Entradas por zona
      for (const [zoneKey, info] of zoneAgg) {
        const tables = Array.from(info.tableNames).join(", ");
        line_items.push({
          quantity: info.qty,
          price_data: {
            currency: "mxn",
            unit_amount: info.unit_amount, // precio por asiento (centavos)
            product_data: {
              name: `Entradas • ${zoneKey} (${tables})`,
              metadata: { eventId, zoneId: zoneKey },
            },
          },
        });
      }

      // 2) Tarifa de servicio como línea separada
      if (pricing.feesCents > 0) {
        line_items.push({
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: pricing.feesCents,
            product_data: {
              name: `Tarifa de servicio (${pricing.servicePct ?? 5}%)`,
              metadata: { kind: "service_fee", eventId },
            },
          },
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,
        metadata: { orderId, eventId },
        success_url: `${process.env.PUBLIC_URL}/checkout/success?orderId=${orderId}&pm=card&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.PUBLIC_URL}/checkout/cancel?order=${orderId}`,
        // customer_email: req.user?.email,
      });

      order.stripe = { checkoutSessionId: session.id };
      await order.save();

      // Crear holds (uno por asiento) - backward compatible
    // Crear holds (uno por asiento) - TARJETA
const holdDocs = items.flatMap((it: any) =>
  (it.seatIds || []).map((s: string, idx: number) => {
    const seatLabel =
      Array.isArray(it.seatLabels) && typeof it.seatLabels[idx] === "string"
        ? String(it.seatLabels[idx]).trim()
        : undefined;

    // tableLabel: "VIP-01" -> "VIP-A" / "ORO-18" -> "ORO-R"
    const num = parseInt(String(it.tableId).split("-")[1] || "0", 10);
    const tableLetter = Number.isFinite(num) && num > 0 ? numToLetter(num) : undefined;
    const tableLabel = tableLetter
      ? `${String(it.zoneId).toUpperCase()}-${tableLetter}`
      : undefined;

    return {
      eventId,
      sessionId,
      tableId: it.tableId,      // para lógica/bloqueo
      seatId: s,                // para lógica/bloqueo
      zoneId: it.zoneId,        // recomendado
      seatLabel,                // NUEVO: "A4"
      tableLabel,               // NUEVO: "VIP-A"
      userId,
      orderId,
      status: "active",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  })
);

if (holdDocs.length) {
  await SeatHold.insertMany(holdDocs, { ordered: false });
}


      return res.json({ checkoutUrl: session.url, orderId });
    }

    // ----------------------------------------------------------------
    // CASO 2: PAGO EN EFECTIVO (SOLO ADMIN / TAQUILLA)
    // ----------------------------------------------------------------
    if (paymentMethod === "cash") {
      // Validar datos del cliente
      if (!cashCustomer?.name || !cashCustomer.name.trim()) {
        return res.status(400).json({
          error: "bad_request",
          message: "Para pago en efectivo es obligatorio el nombre del cliente.",
        });
      }

      const amountGivenNum = Number(cashPayment?.amountGiven ?? 0);
      const changeNum = Number(cashPayment?.change ?? 0);

      const order = await Order.create({
        ...baseOrderData,
        status: "paid",
        paidAt: now,
        buyer: {
          name: cashCustomer.name.trim(),
          phone: cashCustomer.phone?.trim() || undefined,
          email: cashCustomer.email?.trim() || undefined,
        },
        statusTimeline: [
          { status: "pending_payment", at: now, note: "Orden creada para pago en efectivo" },
          { status: "paid", at: now, note: "Pago en efectivo registrado en taquilla" },
        ],
        cashPayment:
          cashPayment && !Number.isNaN(amountGivenNum)
            ? {
                amountGiven: amountGivenNum,
                change: changeNum,
                registeredAt: now,
                cashierUserId: userId,
              }
            : undefined,
      });

      const orderId: string = String(order._id as unknown as Types.ObjectId);



            // ------------------------
      // IMPRIMIR BOLETO EN ZEBRA
      // ------------------------
      try {
        const eventName: string =
          (eventDoc as any)?.title ||
          (eventDoc as any)?.name ||
          "Evento Nardeli";

        const eventDateRaw: any =
          sessionDate ||
          (eventDoc as any)?.sessions?.[0]?.date ||
          (eventDoc as any)?.date ||
          undefined;
        const dateLabel: string = eventDateRaw
          ? new Date(eventDateRaw).toLocaleString("es-MX", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "-";

        const eventPlace: string =
          [ (eventDoc as any)?.venue, (eventDoc as any)?.city ]
            .filter(Boolean)
            .join(", ") ||
          (eventDoc as any)?.place ||
          "";

        // Zona / mesa / asientos (resumen de toda la orden)
        const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null;
        const zone: string = firstItem?.zoneId
          ? String(firstItem.zoneId).toUpperCase()
          : "GENERAL";

        const tableSet = new Set<string>();
        const seatLabels: string[] = [];
        for (const it of items as any[]) {
          if (it.tableId) tableSet.add(String(it.tableId));
          for (const s of it.seatIds || []) {
            seatLabels.push(String(s));
          }
        }
        const tableLabel = Array.from(tableSet).join(", ");

        // Precio total en formato bonito
        const totalPesos = pricing.totalCents / 100;
        const priceLabel = new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
        }).format(totalPesos);

        const payload: NardeliTicketPayload = {
          eventName,
          dateLabel,
          eventPlace,
          orderFolio: orderId,
          zone,
          tableLabel,
          seatLabels,
          buyerName: cashCustomer.name.trim(),
          priceLabel,
          ticketCode: orderId, // lo mismo que Folio
        };

        await printNardeliTicket(payload);
        console.log("✅ Boleto impreso en Zebra para orden", orderId);
      } catch (printErr) {
        console.error("Error imprimiendo boleto en Zebra:", printErr);
      }




      // Para efectivo: los asientos ya quedan "vendidos" de inmediato
      const holdDocs = items.flatMap((it: any) =>
        (it.seatIds || []).map((s: string, idx: number) => {
          const seatLabel =
            Array.isArray(it.seatLabels) && typeof it.seatLabels[idx] === "string"
              ? String(it.seatLabels[idx]).trim()
              : undefined;


          // opción 1 (recomendada): calcular tableLabel desde tableId "ORO-18" => "R"
          const num = parseInt(String(it.tableId).split("-")[1] || "0", 10);
          const tableLetter = Number.isFinite(num) && num > 0 ? numToLetter(num) : undefined;
          const tableLabel = tableLetter ? `${String(it.zoneId).toUpperCase()}-${tableLetter}` : undefined;

          return {
            eventId,
            sessionId,
            tableId: it.tableId,      // se queda así para lógica/bloqueo
            seatId: s,                // se queda así para lógica/bloqueo
            seatLabel,                // 👈 NUEVO: "R2"
            tableLabel,               // 👈 NUEVO: "ORO-R" (o guarda solo "R" si prefieres)
            userId,
            orderId,
            status: "sold",
            expiresAt: null,
            zoneId: it.zoneId,        // 👈 recomendado guardarlo también
          };
        })
      );

      if (holdDocs.length) {
        await SeatHold.insertMany(holdDocs, { ordered: false });
      }


      const successUrl = `${process.env.PUBLIC_URL}/checkout/success?orderId=${orderId}`;

      return res.json({ ok: true, orderId, successUrl });


      
    }

    // Si llega algo raro
    return res
      .status(400)
      .json({ error: "invalid_payment_method", message: "Método de pago inválido" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "checkout_failed", message: err.message });
  }
};

/**
 * GET /api/tickets/:ticketId.pdf
 * Genera un PDF de UN boleto (ticketId) buscando dentro de la colección Order.
 */
export async function streamSingleTicketPdf(req: Request, res: Response) {
  try {
    const { ticketId } = req.params;

    // 1) Busca la orden que contiene ese ticket
    const order = await Order.findOne({ "tickets.ticketId": ticketId }).lean();
    if (!order) return res.status(404).json({ message: "Boleto no encontrado" });

    const ticket = (order.tickets || []).find(
      (t: any) => String(t.ticketId) === String(ticketId)
    );
    if (!ticket) return res.status(404).json({ message: "Boleto no encontrado" });

    // 2) Carga (opcional) del evento para encabezado
    let event: any = null;
    if (order.eventId) {
      event = await Event.findById(order.eventId).lean();
    }

    // 3) Headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="ticket-${ticketId}.pdf"`);

    // 4) PDF streaming
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    doc.pipe(res);

    // Base pública para QR/links
    const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:5173";

    // URL de verificación (ajusta al endpoint real si ya lo tienes)
    const verifyUrl = `${PUBLIC_BASE}/tickets/verify?oid=${order._id}&tid=${ticketId}`;

    // Utilidad: QR -> Buffer PNG
    async function toQrBuf(text: string): Promise<Buffer> {
      const dataUrl = await QRCode.toDataURL(text, {
        errorCorrectionLevel: "M",
        margin: 1,
        scale: 6,
      });
      const base64 = dataUrl.split(",")[1];
      return Buffer.from(base64, "base64");
    }

    // ------- Render del boleto -------
    // Encabezado
    const eventTitle = event?.title || "Evento";
    const eventDate = order.sessionDate || event?.sessions?.[0]?.date || null;
    const eventLoc = [event?.venue, event?.city].filter(Boolean).join(", ");

    doc.fontSize(22).fillColor("#111").text("NardeliTicket");
    doc
      .moveDown(0.3)
      .fontSize(14)
      .fillColor("#444")
      .text(`${eventTitle}  |  Folio: #${order._id}`);

    if (eventDate) {
      const f = new Date(eventDate).toLocaleString("es-MX");
      doc.fontSize(12).fillColor("#444").text(`Fecha: ${f}`);
    }
    if (eventLoc) {
      doc.fontSize(12).fillColor("#444").text(`Lugar: ${eventLoc}`);
    }
    doc.moveDown();

    // Tarjeta
    const cardX = 36,
      cardY = 140,
      cardW = doc.page.width - 72,
      cardH = 170;
    doc
      .roundedRect(cardX, cardY, cardW, cardH, 10)
      .strokeColor("#e5e7eb")
      .lineWidth(1.5)
      .stroke();
    doc.fontSize(18).fillColor("#111").text("Boleto", cardX + 12, cardY + 12);

    doc.fontSize(12).fillColor("#333");
    doc.text(`Ticket ID: ${ticket.ticketId}`, cardX + 12, cardY + 40);
    const isGeneralTicket =
      String((ticket as any).zoneId ?? "").toUpperCase() === "GENERAL" ||
      (order as any).admissionType === "general";
    if (isGeneralTicket) {
      doc.text(`Tipo de acceso: Admisión general`, cardX + 12, cardY + 58);
      doc.text(`Presenta este boleto en el acceso.`, cardX + 12, cardY + 76);
    } else {
      doc.text(`Zona: ${ticket.zoneId}`, cardX + 12, cardY + 58);
      doc.text(`Mesa: ${ticket.tableId}`, cardX + 12, cardY + 76);
      doc.text(`Asiento: ${ticket.seatId}`, cardX + 12, cardY + 94);
    }

    const qrBuf = await toQrBuf(verifyUrl);
    const qrSize = 170;
    doc.image(qrBuf, cardX + cardW - qrSize - 12, cardY + 12, {
      width: qrSize,
      height: qrSize,
    });

    doc
      .fillColor("#6b7280")
      .fontSize(10)
      .text(`Escanea el QR para validar tu boleto.`, cardX + 12, cardY + cardH + 12, {
        width: cardW - 24,
      });

    doc.end();
  } catch (err) {
    console.error("PDF ticket error:", err);
    res.status(500).json({ message: "No se pudo generar el PDF del boleto" });
  }
}

export async function generateOrderTicketsPdfs(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Orden no encontrada" });
    if (order.status !== "paid") {
      return res.status(400).json({ message: "La orden no está pagada" });
    }

    const event = order.eventId ? await Event.findById(order.eventId).lean() : null;

    // ================================================================
    // ADMISIÓN GENERAL: los boletos no tienen asiento; se generan desde
    // order.tickets (emitidos por webhook en tarjeta o al cobrar en efectivo).
    // ================================================================
    if ((order as any).admissionType === "general" || (event as any)?.admissionType === "general") {
      const genTickets = (order.tickets || []).filter((t: any) => t.status !== "void");
      if (!genTickets.length) {
        return res.status(400).json({ message: "No hay boletos emitidos para esta orden" });
      }

      const eventName = event?.title ?? "Evento";
      const eventDate = (order as any).sessionDate ?? event?.sessions?.[0]?.date ?? undefined;
      const eventPlace = [event?.venue, event?.city].filter(Boolean).join(", ");
      const orderForPdf = { ...order, eventName, eventDate, eventPlace };
      const pricePesos = event ? generalPriceCents(event) / 100 : undefined;

      const genTotal = (genTickets as any[]).length;
      for (let i = 0; i < (genTickets as any[]).length; i++) {
        const t = (genTickets as any[])[i];
        await ensureTicketPdf({
          ticketId: t.ticketId,
          order: orderForPdf,
          seat: {
            general: true,
            ticketNumber: i + 1,
            ticketTotal: genTotal,
            price: pricePesos,
          },
        });
      }

      const origin = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
      const base = `${origin}/files/tickets`;
      const files = (genTickets as any[]).map((t) => ({
        ticketId: t.ticketId,
        fileName: ticketFileName(t.ticketId),
        url: `${base}/${ticketFileName(t.ticketId)}`,
      }));

      const ticketIds = (genTickets as any[]).map((t) => t.ticketId);
      await ensureMergedTicketsPdf(String(order._id), ticketIds);
      const merged = {
        fileName: mergedTicketFileName(String(order._id)),
        url: `${base}/${mergedTicketFileName(String(order._id))}`,
      };

      return res.json({ orderId, count: files.length, files, merged });
    }

    const seats = await SeatHold.find({
  orderId,
  status: { $in: ["sold", "active"] }, // card -> active, cash -> sold
}).lean();

    console.log("SeatHold sample:", seats[0]);

    const tickets = seats.map((s: any) => ({
  ticketId: String(s._id),       // 👈 ticket pdf id = SeatHold _id (consistente)
  seatId: String(s.seatId),
  tableId: s.tableId,
  zoneId: s.zoneId,
  seatLabel: s.seatLabel,
  tableLabel: s.tableLabel,
}));





    if (!tickets.length) {
      return res
        .status(400)
        .json({ message: "No hay tickets/asientos vendidos para esta orden" });
    }

    const itemBySeat = new Map<string, any>();
    for (const it of (order as any).items || []) {
      for (const sid of it.seatIds || []) {
        itemBySeat.set(String(sid), it);
      }
    }

    // generar PDFs individuales
    for (const t of tickets) {
      const s =
  seats.find((x: any) => String(x._id) === String(t.ticketId)) ||
  seats.find((x: any) => String(x.seatId) === String(t.seatId)) || // ✅
  ({} as any);


      const it =
        itemBySeat.get(String(s.seatId)) ||
        itemBySeat.get(String(s._id)) ||
        itemBySeat.get(String(t.seatId)) ||
        null;

      const zoneId = t.zoneId ?? it?.zoneId ?? s.zoneId ?? s.zone ?? undefined;

      let pricePesos: number | undefined = undefined;
      if (event && it) {
        const cents = priceCentsForItem(event, it);
        if (Number.isFinite(cents)) pricePesos = Math.round(cents) / 100;
      } else if (typeof it?.unitPrice === "number") {
        pricePesos = it.unitPrice;
      }

      const rawSeatId = String((s as any)?.seatId ?? (t as any)?.seatId ?? (s as any)?.seat ?? "");
      const idxInItem = Array.isArray(it?.seatIds) ? it.seatIds.findIndex((x: any) => String(x) === rawSeatId) : -1;

      const seatForPdf = {
  zoneId,

  tableLabel:
    (s as any)?.tableLabel ??
    tableLabelFromTableId((t as any)?.tableId ?? (s as any)?.tableId) ??
    undefined,

  seatLabel:
    (s as any)?.seatLabel ??   // ✅ PRIORIDAD ABSOLUTA
    undefined,

  tableId: (t as any)?.tableId ?? (s as any)?.tableId ?? undefined,
  seatId: rawSeatId || undefined,
  price: pricePesos,
};



      const eventName = event?.title ?? "Evento";
      const eventDate =
        (order as any).sessionDate ?? event?.sessions?.[0]?.date ?? undefined;
      const eventPlace = [event?.venue, event?.city].filter(Boolean).join(", ");

      const orderForPdf = {
        ...order,
        eventName,
        eventDate,
        eventPlace,
      };
console.log("DEBUG seatForPdf ->", seatForPdf);

      await ensureTicketPdf({
        ticketId: t.ticketId,
        order: orderForPdf,
        seat: seatForPdf,
      });
    }

    // URLs
    const origin =
      process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    const base = `${origin}/files/tickets`;

    const files = tickets.map((t: any) => ({
      ticketId: t.ticketId,
      fileName: ticketFileName(t.ticketId),
      url: `${base}/${ticketFileName(t.ticketId)}`,
    }));

    // PDF combinado (1 archivo por orden)
    const ticketIds = tickets.map((t: any) => t.ticketId);
    await ensureMergedTicketsPdf(String(order._id), ticketIds);

    const merged = {
      fileName: mergedTicketFileName(String(order._id)),
      url: `${base}/${mergedTicketFileName(String(order._id))}`,
    };

    return res.json({ orderId, count: files.length, files, merged });
  } catch (e: any) {
    console.error("generateOrderTicketsPdfs error:", e);
    return res
      .status(500)
      .json({ message: "No se pudieron generar los PDFs", detail: e.message });
  }
  
}

/**
 * GET /api/checkout/orders/:orderId/status
 * Confirma el pago directamente con Stripe (red de seguridad si el webhook
 * no llegó, p. ej. en local sin Stripe CLI) y finaliza la orden si está pagada.
 */
export async function getOrderStatus(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Orden no encontrada" });

    if (order.status !== "paid" && (order as any)?.stripe?.checkoutSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          (order as any).stripe.checkoutSessionId
        );
        if (session.payment_status === "paid") {
          await fulfillPaidOrder(String(orderId), {
            paymentIntentId: (session.payment_intent as string) || undefined,
          });
        }
      } catch (e) {
        console.error("getOrderStatus retrieve error:", e);
      }
    }

    const fresh = await Order.findById(orderId).lean();
    const ticketCount = (fresh?.tickets || []).filter(
      (t: any) => t.status !== "void"
    ).length;
    return res.json({
      status: fresh?.status,
      paid: fresh?.status === "paid",
      ticketCount,
    });
  } catch (e: any) {
    return res.status(500).json({ message: "Error consultando estado", detail: e.message });
  }
}
