import { Request, Response } from "express";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import { stripe } from "../utils/stripe";
import { Event } from "../models/Event";

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
      success_url: `${process.env.PUBLIC_URL}/checkout/success?order=${order._id}`,
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
