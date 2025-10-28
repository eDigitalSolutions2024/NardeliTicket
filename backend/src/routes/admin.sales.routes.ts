// src/routes/admin.sales.routes.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth"; // export nombrado
import Order from "../models/Order";                      // default export (según tu modelo)
import { Event } from "../models/Event";                  // named export
import { User } from "../models/User";                    // named export

const router = Router();

/** Tipos mínimos para trabajar con .lean() */
type OrderItemLean = {
  zoneId: string;
  tableId: string;
  seatIds: string[];
  unitPrice: number;
};

type TicketLean = {
  ticketId: string;
  seatId: string;
  tableId: string;
  zoneId: string;
  qrUrl?: string;
  status: "issued" | "checked_in" | "void";
  issuedAt: Date;
  checkedInAt?: Date;
};

type OrderLean = {
  _id: any;
  currency: "MXN";
  userId: string;
  eventId: string;
  sessionDate?: Date;
  items: OrderItemLean[];
  tickets?: TicketLean[];
  totals: { subtotal: number; fees: number; total: number; seatCount: number };
  status: "pending" | "requires_payment" | "pending_payment" | "paid" | "canceled" | "expired" | "failed" | string;
  method?: "stripe" | "cash" | "other" | string;
  createdAt?: Date;
  paidAt?: Date;
};

router.get("/sales", requireAuth, async (req, res) => {
  try {
    const { from, to, eventId, status, q } = req.query as {
      from?: string;
      to?: string;
      eventId?: string;
      status?: string;
      q?: string;
    };

    /** ---------------- Filtro base ---------------- */
    const match: any = {};

    // Rango de fechas (usa createdAt; cambia a paidAt si te conviene)
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    // Estado (incluye alias para "pendiente")
    if (status) {
      if (status === "pending") {
        match.status = { $in: ["pending", "pending_payment", "requires_payment"] };
      } else {
        match.status = status;
      }
    }

    // Evento (top-level en tu esquema)
    if (eventId) match.eventId = eventId;

    /** ---------------- Consultas ---------------- */
    const orders = (await Order.find(match).lean()) as unknown as OrderLean[];

    // Prepara mapas de eventos y usuarios para enriquecer
    const evIds = Array.from(new Set(orders.map(o => o.eventId).filter(Boolean)));
    const userIds = Array.from(new Set(orders.map(o => o.userId).filter(Boolean)));

    const [events, users] = await Promise.all([
      evIds.length ? Event.find({ _id: { $in: evIds } }).lean() : [],
      userIds.length ? User.find({ _id: { $in: userIds } }).lean() : [],
    ]);

    const evMap   = new Map<string, any>(events.map((e: any) => [String(e._id), e]));
    const userMap = new Map<string, any>(users.map((u: any) => [String(u._id), u]));

    /** ---------------- Aplanado a nivel “boleto/asiento” ---------------- */
    const rows: any[] = [];

    for (const o of orders) {
      const buyer = userMap.get(String(o.userId));
      const userName  = buyer?.name ?? "";
      const userEmail = buyer?.email ?? "";
      const userPhone = buyer?.phone ?? "";

      const ev = evMap.get(String(o.eventId));
      const eventTitle = ev?.title ?? "";

      // Para lookup de precio por seatId cuando hay tickets
      const priceBySeat = new Map<string, number>();
      for (const it of o.items || []) {
        for (const sid of it.seatIds || []) priceBySeat.set(sid, it.unitPrice ?? 0);
      }

      if (o.tickets && o.tickets.length > 0) {
        // 1 fila por ticket emitido
        for (const t of o.tickets) {
          rows.push({
            ticketId: t.ticketId || "",
            orderId: String(o._id),
            eventId: o.eventId,
            eventTitle,
            sessionDate: o.sessionDate ?? null,
            zone: t.zoneId ?? "",
            seatNumber: t.seatId ?? "",
            seatLabel: t.seatId ?? "",
            price: priceBySeat.get(t.seatId) ?? 0,
            status: o.status,
            method: o.method || "stripe",
            userId: o.userId,
            userName,
            userEmail,
            userPhone,
            createdAt: o.createdAt ?? null,
            paidAt: o.paidAt ?? null,
          });
        }
      } else {
        // No hay tickets aún (pendiente): 1 fila por asiento de items[]
        for (const it of o.items || []) {
          for (const seatId of it.seatIds || []) {
            rows.push({
              ticketId: "", // aún no emitido
              orderId: String(o._id),
              eventId: o.eventId,
              eventTitle,
              sessionDate: o.sessionDate ?? null,
              zone: it.zoneId ?? "",
              seatNumber: seatId ?? "",
              seatLabel: seatId ?? "",
              price: it.unitPrice ?? 0,
              status: o.status,
              method: o.method || "stripe",
              userId: o.userId,
              userName,
              userEmail,
              userPhone,
              createdAt: o.createdAt ?? null,
              paidAt: o.paidAt ?? null,
            });
          }
        }
      }
    }

    /** ---------------- Búsqueda de texto libre ---------------- */
    if (q) {
      const s = String(q).toLowerCase();
      const f = (v?: string) => String(v ?? "").toLowerCase();
      const keep = (r: any) =>
        f(r.ticketId).includes(s) ||
        f(r.eventTitle).includes(s) ||
        f(r.zone).includes(s) ||
        f(r.seatLabel).includes(s) ||
        f(r.userName).includes(s) ||
        f(r.userEmail).includes(s) ||
        f(r.userPhone).includes(s) ||
        f(r.orderId).includes(s);
      for (let i = rows.length - 1; i >= 0; i--) if (!keep(rows[i])) rows.splice(i, 1);
    }

    const totalAmount = rows.reduce((a, r) => a + (r.price ?? 0), 0);
    res.json({ rows, totalAmount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "sales_fetch_failed" });
  }
});

export default router;
