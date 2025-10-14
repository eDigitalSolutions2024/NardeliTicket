import { Router } from "express";
import { createCheckout } from "../controllers/checkout.controller";
import { requireAuth } from "../middlewares/requireAuth"; // usa tu middleware real

const router = Router();

router.post("/", requireAuth, createCheckout);

export default router;
