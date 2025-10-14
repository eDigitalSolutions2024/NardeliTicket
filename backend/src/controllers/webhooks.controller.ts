import { Request, Response } from "express";
import { stripe } from "../utils/stripe";
import Order from "../models/Order";

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
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          status: "paid",
          "stripe.paymentIntentId": session.payment_intent,
        });
        // TODO: aquí puedes consolidar la reserva definitiva
      }
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, { status: "expired" });
        // Los holds expiran solos por TTL
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
};
