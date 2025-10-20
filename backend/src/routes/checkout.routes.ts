import { Router } from "express";
import { createCheckout, preflightCheckout } from "../controllers/checkout.controller";
import { requireAuth } from "../middlewares/requireAuth"; // usa tu middleware real

const router = Router();

// NUEVO: preflight antes de crear la sesión
router.post("/preflight", requireAuth, preflightCheckout);

router.post("/", requireAuth, createCheckout);

export default router;
