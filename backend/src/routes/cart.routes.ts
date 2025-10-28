// src/routes/cart.routes.ts
import { Router } from "express";
import Cart from "../models/Cart";
import { authOptional } from "../middlewares/authOptional"; // 👈 nuevo

const r = Router();

/** Obtener carrito */
r.get("/", authOptional, async (req: any, res) => {
  const sessionid = String((req.headers as any).sessionid || "");
  const filter = req.user ? { userId: req.user._id } : { sessionId: sessionid };
  const cart = await Cart.findOne(filter).lean();
  res.json(cart ?? { items: [] });
});

/** Agregar/actualizar item(s) del evento actual */
r.post("/items", authOptional, async (req: any, res) => {
  const { eventId, items } = req.body || {};
  const sessionid = String((req.headers as any).sessionid || "");
  if (!eventId || !Array.isArray(items)) return res.status(400).json({ error: "Bad payload" });

  const filter = req.user ? { userId: req.user._id } : { sessionId: sessionid };
  let cart = await Cart.findOne(filter);
  if (!cart) cart = new (Cart as any)(filter);

  const keepOthers = (cart.items || []).filter((i: any) => String(i.eventId) !== String(eventId));
  cart.items = [
    ...keepOthers,
    ...items.map((it: any) => ({
      eventId,
      zoneId: it.zoneId,
      tableId: it.tableId,
      seats: it.seatIds,
      price: it.unitPrice,
    })),
  ];
  cart.updatedAt = new Date();
  await cart.save();

  const eventsCount = new Set(cart.items.map((i: any) => String(i.eventId))).size;
  res.json({ ok: true, eventsCount, cartId: cart._id });
});

/** Resumen para el badge del navbar */
r.get("/summary", authOptional, async (req: any, res) => {
  const sessionid = String((req.headers as any).sessionid || "");
  const filter = req.user ? { userId: req.user._id } : { sessionId: sessionid };
  const cart = await Cart.findOne(filter).lean();
  const count = cart ? new Set(cart.items.map((i: any) => String(i.eventId))).size : 0;
  res.json({ eventsCount: count });
});

export default r;
