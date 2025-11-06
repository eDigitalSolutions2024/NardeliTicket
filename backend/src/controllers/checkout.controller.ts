// src/controllers/checkout.controller.ts
import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import { stripe } from "../utils/stripe";
import { Event } from "../models/Event";
import { ensureTicketPdf, ticketFileName } from "../utils/tickets";

// ---------- Utilidades de pricing (centavos) ----------
const SERVICE_FEE_PCT = 5;

function zonePriceCentsFromEvent(eventDoc: any, zoneId: string): number {
  const key = String(zoneId || "").toLowerCase(); // "vip" | "oro"
  const cents = eventDoc?.pricingCents?.[key];
  if (typeof cents === "number" && cents >= 0) return cents;
  // fallback a pesos si no está migrado (multiplica *100)
  const pesos = eventDoc?.pricing?.[key];
  return typeof pesos === "number" ? Math.round(pesos * 100) : 0;
}

function priceCentsForItem(eventDoc: any, it: any): number {
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
    const qty = Array.isArray(it.seatIds) ? it.seatIds.length : 0;
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
    const { eventId, items } = req.body ?? {};
    if (!eventId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "bad_request", message: "eventId e items son requeridos" });
    }

    const eventDoc = await Event.findById(eventId).lean();
    if (!eventDoc) return res.status(404).json({ error: "not_found", message: "Evento no existe" });

    // TODO (opcional): validar que asientos no estén vendidos / retenidos por otro usuario

    const pricing = computePricingCents(eventDoc, items);

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
    const { eventId, items, totals, sessionDate, pricing: pricingFromClient } = req.body;

    if (!eventId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "bad_request", message: "eventId e items son requeridos" });
    }

    const eventDoc = await Event.findById(eventId).lean();
    if (!eventDoc) return res.status(404).json({ error: "not_found", message: "Evento no existe" });

    // Recalcula en servidor si no recibimos pricing del preflight (backward compatible)
    const pricing =
      pricingFromClient && typeof pricingFromClient.totalCents === "number"
        ? pricingFromClient
        : computePricingCents(eventDoc, items);

    const userId = req.user?.id || req.user?._id || req.user?.email || "anon";

    // Orden en pending_payment y totales en centavos
    const order = await Order.create({
      userId,
      eventId,
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
      status: "pending_payment",
      statusTimeline: [{ status: "pending_payment", at: new Date() }],
    });

    // Agrupar por zona para líneas de "entradas"
    const zoneAgg = new Map<string, { qty: number; unit_amount: number; tableNames: Set<string> }>();
    for (const it of items) {
      const qty = Array.isArray(it.seatIds) ? it.seatIds.length : 0;
      if (!qty) continue;

      const zoneKey = String(it.zoneId).toUpperCase(); // "VIP" | "ORO"
      const priceCents = priceCentsForItem(eventDoc, it); // <-- usa el helper con fallback

      const current = zoneAgg.get(zoneKey) || { qty: 0, unit_amount: priceCents, tableNames: new Set<string>() };
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
      metadata: { orderId: order._id.toString(), eventId },
      success_url: `${process.env.PUBLIC_URL}/checkout/success?orderId=${order._id}`,
      cancel_url: `${process.env.PUBLIC_URL}/checkout/cancel?order=${order._id}`,
      // customer_email: req.user?.email,
    });

    order.stripe = { checkoutSessionId: session.id };
    await order.save();

    // Crear holds (uno por asiento) - backward compatible
    const holdDocs = items.flatMap((it: any) =>
      (it.seatIds || []).map((s: string) => ({
        eventId,
        tableId: it.tableId,
        seatId: s,
        userId,
        orderId: order._id.toString(),
        status: "active",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }))
    );
    if (holdDocs.length) {
      await SeatHold.insertMany(holdDocs, { ordered: false });
    }

    return res.json({ checkoutUrl: session.url, orderId: order._id });
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

    const ticket = (order.tickets || []).find((t) => String(t.ticketId) === String(ticketId));
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
    const eventDate =
      order.sessionDate || event?.sessions?.[0]?.date || null;
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
    doc.text(`Zona: ${ticket.zoneId}`, cardX + 12, cardY + 58);
    doc.text(`Mesa: ${ticket.tableId}`, cardX + 12, cardY + 76);
    doc.text(`Asiento: ${ticket.seatId}`, cardX + 12, cardY + 94);

    const qrBuf = await toQrBuf(verifyUrl);
    const qrSize = 170;
    doc.image(qrBuf, cardX + cardW - qrSize - 12, cardY + 12, { width: qrSize, height: qrSize });

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

    // 1) Cargar evento para título/fecha/lugar
    const event = order.eventId ? await Event.findById(order.eventId).lean() : null;

    // 2) Asientos ligados a la orden (usa el campo correcto: orderId)
    const seats = await SeatHold.find({ orderId, status: "sold" }).lean();

    // 3) Tickets (de order.tickets o derivados de seats)
    const tickets =
      order.tickets && order.tickets.length
        ? order.tickets.map((t: any) => ({
            ticketId: String(t.ticketId),
            seatId: String(t.seatId),
            tableId: t.tableId,
            zoneId: t.zoneId,
          }))
        : seats.map((s: any) => ({
            ticketId: String(s._id),
            seatId: String(s._id),
            tableId: s.tableId,
            zoneId: s.zoneId,
          }));

    if (!tickets.length) {
      return res.status(400).json({ message: "No hay tickets/asientos vendidos para esta orden" });
    }

    // 4) Mapa seatId -> item para extraer zona y precio
    const itemBySeat = new Map<string, any>();
    for (const it of order.items || []) {
      for (const sid of it.seatIds || []) {
        itemBySeat.set(String(sid), it);
      }
    }

    // 5) Enriquecer y generar PDFs
    for (const t of tickets) {
      const s =
        seats.find((x: any) => String(x._id) === String(t.seatId)) || ({} as any);
      const it =
        itemBySeat.get(String(s.seatId)) ||
        itemBySeat.get(String(s._id)) ||
        itemBySeat.get(String(t.seatId)) ||
        null;

      // zona
      const zoneId = t.zoneId ?? it?.zoneId ?? s.zoneId ?? s.zone ?? undefined;

      // precio (centavos -> pesos) usando el helper
      let pricePesos: number | undefined = undefined;
      if (event && it) {
        const cents = priceCentsForItem(event, it);
        if (Number.isFinite(cents)) pricePesos = Math.round(cents) / 100;
      } else if (typeof it?.unitPrice === "number") {
        pricePesos = it.unitPrice;
      }

      const seatForPdf = {
        zoneId,
        tableId: t.tableId ?? s.tableId ?? s.table ?? undefined,
        seatId: s.seatId ?? t.seatId ?? s.seat ?? undefined,
        price: pricePesos,
      };

      // Datos del evento listos para el PDF
      const eventName = event?.title ?? "Evento";
      const eventDate = order.sessionDate ?? event?.sessions?.[0]?.date ?? undefined;
      const eventPlace = [event?.venue, event?.city].filter(Boolean).join(", ");

      const orderForPdf = {
        ...order,
        eventName,
        eventDate,
        eventPlace,
      };

      await ensureTicketPdf({
        ticketId: t.ticketId,
        order: orderForPdf,
        seat: seatForPdf,
      });
    }

    // 6) Responder con URLs públicas de los PDFs en /files/tickets
    const base = `${req.protocol}://${req.get("host")}/files/tickets`;
    const files = tickets.map((t: any) => ({
      ticketId: t.ticketId,
      fileName: ticketFileName(t.ticketId),
      url: `${base}/${ticketFileName(t.ticketId)}`,
    }));

    return res.json({ orderId, count: files.length, files });
  } catch (e: any) {
    console.error("generateOrderTicketsPdfs error:", e);
    return res.status(500).json({ message: "No se pudieron generar los PDFs", detail: e.message });
  }
}
