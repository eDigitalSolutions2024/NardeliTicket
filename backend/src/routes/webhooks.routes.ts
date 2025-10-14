import { Router } from "express";
import { stripeWebhook } from "../controllers/webhooks.controller";
import express from "express";

const router = Router();

// ¡ojo! raw body para webhook
router.post("/stripe", express.raw({ type: "application/json" }), stripeWebhook);

export default router;
