// src/routes/whatsapp.routes.ts
import { Router } from "express";
import { sendTicketsController } from "../controllers/whatsapp.controller";

const router = Router();

// POST /api/whatsapp/send-tickets
router.post("/send-tickets", sendTicketsController);

export default router;
