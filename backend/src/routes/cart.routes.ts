// src/routes/cart.routes.ts
import { Router, Request, Response } from "express";
import Cart from "../models/Cart";
import { authOptional } from "../middlewares/authOptional";

const r = Router();

type ReqWithOptUser = Request & { user?: any };

// --- GET /api/cart  -> obtener carrito ---
r.get("/", authOptional, async (req: ReqWithOptUser, res: Response) => {
  const sessionid = String((req.headers as any).sessionid || "");
  const filter = req.user ? { userId: req.user._id } : { sessionId: sessionid };

  const cart = await Cart.findOne(filter).lean();
  res.json(cart ?? { items: [] });
});

// --- POST /api/cart/items  -> agregar/actualizar items del evento actual ---
r.post("/items", authOptional, async (req: ReqWithOptUser, res: Response) => {
  const { eventId, items } = (req.body ?? {}) as { eventId?: string; items?: any[] };
  const sessionid = String((req.headers as any).sessionid || "");
  if (!eventId || !Array.isArray(items)) {
    return res.status(400).json({ error: "Bad payload" });
  }

  const filter = req.user ? { userId: req.user._id } : { sessionId: sessionid };

  // Lee el carrito en lean() para evitar DocumentArray typings
  const existing = await Cart.findOne(filter).lean();

  // Mantén otros eventos y mezcla con los nuevos
  const keepOthers = (existing?.items ?? []).filter(
    (i: any) => String(i.eventId) !== String(eventId)
  );

  const merged = [
    ...keepOthers,
    ...items.map((it: any) => ({
      eventId,
      zoneId: it.zoneId,
      tableId: it.tableId,
      seats: it.seatIds,
      price: it.unitPrice,
    })),
  ];

  // Persiste con upsert para evitar “possibly null” y choques de tipos
  const updated = await Cart.findOneAndUpdate(
    filter,
    {
      $set: {
        items: merged,
        updatedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      // si tu esquema tiene validaciones estrictas que chocan, puedes habilitar:
      // runValidators: false,
    }
  ).lean();

  const eventsCount = new Set((updated?.items ?? []).map((i: any) => String(i.eventId))).size;
  return res.json({ ok: true, eventsCount, cartId: updated?._id });
});

// --- GET /api/cart/summary  -> contador para el badge del navbar ---
r.get("/summary", authOptional, async (req: ReqWithOptUser, res: Response) => {
  const sessionid = String((req.headers as any).sessionid || "");
  const filter = req.user ? { userId: req.user._id } : { sessionId: sessionid };

  const cart = await Cart.findOne(filter).lean();
  const count = cart ? new Set((cart.items ?? []).map((i: any) => String(i.eventId))).size : 0;

  res.json({ eventsCount: count });
});

export default r;
