import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import { nanoid } from "nanoid";

/**
 * Emite los boletos de una orden (asientos o admisión general).
 */
function buildTicketsForOrder(orderId: string, items: any[]) {
  const tickets: any[] = [];
  let genIndex = 0;
  for (const it of items || []) {
    const { zoneId, tableId, seatIds = [], quantity } = it as any;
    if (Array.isArray(seatIds) && seatIds.length) {
      for (const seatId of seatIds) {
        tickets.push({
          ticketId: `${orderId}-${seatId}-${nanoid(6)}`,
          seatId,
          tableId,
          zoneId,
          status: "issued",
          issuedAt: new Date(),
        });
      }
    } else {
      const qty = Number.isFinite(Number(quantity)) ? Math.floor(Number(quantity)) : 0;
      for (let i = 0; i < qty; i++) {
        genIndex++;
        tickets.push({
          ticketId: `${orderId}-GEN-${genIndex}-${nanoid(6)}`,
          seatId: `GEN-${genIndex}`,
          tableId: tableId || "GENERAL",
          zoneId: zoneId || "GENERAL",
          status: "issued",
          issuedAt: new Date(),
        });
      }
    }
  }
  return tickets;
}

/**
 * Marca una orden como pagada, emite sus boletos y vende sus holds.
 * Es idempotente: si ya está pagada con boletos, no hace nada.
 */
export async function fulfillPaidOrder(
  orderId: string,
  opts: { paymentIntentId?: string } = {}
): Promise<boolean> {
  const order = await Order.findById(orderId);
  if (!order) return false;

  const alreadyDone = order.status === "paid" && (order.tickets?.length ?? 0) > 0;
  if (alreadyDone) return true;

  if (!order.tickets || order.tickets.length === 0) {
    order.tickets = buildTicketsForOrder(orderId, order.items || []) as any;
  }

  order.status = "paid";
  order.paidAt = order.paidAt || new Date();
  if (opts.paymentIntentId) {
    order.stripe = { ...(order.stripe || {}), paymentIntentId: opts.paymentIntentId };
  }
  order.statusTimeline = [
    ...(order.statusTimeline || []),
    { status: "paid", at: new Date() },
  ];
  await order.save();

  await SeatHold.updateMany(
    { orderId, status: { $in: ["active", "attached_to_order"] } },
    { $set: { status: "sold" } }
  );

  return true;
}
