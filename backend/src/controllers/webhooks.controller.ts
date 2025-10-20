import { Request, Response } from "express";
import { stripe } from "../utils/stripe";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body!
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId as string | undefined;

      if (orderId) {
        // Actualiza la orden como pagada
        await Order.findByIdAndUpdate(orderId, {
          status: "paid",
          paidAt: new Date(),
          "stripe.paymentIntentId": session.payment_intent,
        });

        // Marca los holds de esa orden como vendidos
        await SeatHold.updateMany(
          { orderId, status: { $in: ["active", "attached_to_order"] } },
          { $set: { status: "sold" } }
        );
      }
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId as string | undefined;

      if (orderId) {
        await Order.findByIdAndUpdate(orderId, { status: "expired" });

        // Libera holds
        await SeatHold.updateMany(
          { orderId, status: { $in: ["active", "attached_to_order"] } },
          { $set: { status: "released" } }
        );
      }
      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId as string | undefined;

      if (orderId) {
        await Order.findByIdAndUpdate(orderId, { status: "failed" });

        // Libera holds (dejan de bloquear asiento)
        await SeatHold.updateMany(
          { orderId, status: { $in: ["active", "attached_to_order"] } },
          { $set: { status: "released" } }
        );
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
};
