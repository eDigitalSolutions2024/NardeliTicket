import { Router } from "express";
import { createCheckout, preflightCheckout, streamSingleTicketPdf, generateOrderTicketsPdfs } from "../controllers/checkout.controller";
import { requireAuth } from "../middlewares/requireAuth"; // usa tu middleware real
import Order from "../models/Order";

const router = Router();

// NUEVO: preflight antes de crear la sesión
router.post("/preflight", requireAuth, preflightCheckout);
router.post("/", requireAuth, createCheckout);
router.get("/tickets/:ticketId.pdf", streamSingleTicketPdf);
router.get("/orders/:orderId/tickets", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Orden no encontrada" });
    const ids = (order.tickets || [])
      .filter((t) => t.status !== "void")
      .map((t) => t.ticketId);
    return res.json(ids);
  } catch (e) {
    return res.status(500).json({ message: "Error obteniendo tickets" });
  }
});
router.post("/orders/:orderId/tickets/generate", generateOrderTicketsPdfs);
export default router;
