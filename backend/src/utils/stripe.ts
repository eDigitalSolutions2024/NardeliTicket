import "dotenv/config";               // <- Carga .env ANTES
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  throw new Error("Missing STRIPE_SECRET_KEY env var");
}

export const stripe = new Stripe(key, {
  apiVersion: "2024-06-20",           // <- Literal string soportado por el SDK moderno
});
