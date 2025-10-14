import { Request, Response } from "express";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import { stripe } from "../utils/stripe";

/** POST /api/checkout */
export const createCheckout = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { eventId, items, totals, sessionDate } = req.body;

    // (opcional) aquí podrías validar que no existan holds/reservas previas para esos asientos

    const userId = req.user?.id || req.user?._id || req.user?.email || "anon";
    const order = await Order.create({
      userId,
      eventId,
      sessionDate,
      items,
      totals,
      status: "requires_payment",
    });

    const line_items = items.map((it: any) => ({
      quantity: it.seatIds.length,
      price_data: {
        currency: "mxn",
        unit_amount: Math.round(Number(it.unitPrice) * 100),
        product_data: {
          name: `${it.zoneId} • ${it.tableId}`,
          metadata: { eventId, tableId: it.tableId, zoneId: it.zoneId },
        },
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      metadata: { orderId: order._id.toString(), eventId },
      success_url: `${process.env.PUBLIC_URL}/checkout/success?order=${order._id}`,
      cancel_url: `${process.env.PUBLIC_URL}/checkout/cancel?order=${order._id}`,
      // customer_email: req.user?.email, // si tienes email en el token
    });

    order.stripe = { checkoutSessionId: session.id };
    await order.save();

    // Crear holds (uno por asiento)
    const holdDocs = items.flatMap((it: any) =>
      it.seatIds.map((s: string) => ({
        eventId,
        tableId: it.tableId,
        seatId: s,
        userId,
        orderId: order._id.toString(),
      }))
    );
    if (holdDocs.length) await SeatHold.insertMany(holdDocs);

    return res.json({ checkoutUrl: session.url, orderId: order._id });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "checkout_failed", message: err.message });
  }
};
