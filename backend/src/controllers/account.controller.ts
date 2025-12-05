// src/controllers/account.controller.ts
import { RequestHandler } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";

// 👇 NUEVO
import Order from "../models/Order";
import { Event } from "../models/Event";

export const getAccount: RequestHandler = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "No autorizado" });

  const user = await User.findById(uid).lean();
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const { passwordHash, ...safe } = user as any;
  return res.json(safe);
};

export const updateProfile: RequestHandler = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "No autorizado" });

  const { name, phone } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "El nombre es requerido" });
  }

  const user = await User.findByIdAndUpdate(
    uid,
    {
      $set: {
        name: String(name).trim(),
        ...(phone ? { phone: String(phone).trim() } : {}),
      },
    },
    { new: true }
  ).lean();

  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const { passwordHash, ...safe } = user as any;
  return res.json(safe);
};

export const changePassword: RequestHandler = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "No autorizado" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Faltan campos" });
  }
  if (String(newPassword).length < 8) {
    return res
      .status(400)
      .json({ message: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  const user = await User.findById(uid);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) return res.status(400).json({ message: "Contraseña actual incorrecta" });

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  return res.json({ ok: true });
};

// 👇 NUEVO: compras del usuario logueado
export const getMyPurchases: RequestHandler = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "No autorizado" });

  // 1) Traer órdenes del usuario
  const orders = await Order.find({ userId: uid })
    .sort({ createdAt: -1 })
    .lean();

  // 2) Traer eventos relacionados
  const evIds = Array.from(
    new Set(orders.map((o: any) => String(o.eventId)).filter(Boolean))
  );

  const events = evIds.length
    ? await Event.find({ _id: { $in: evIds } }).lean()
    : [];

  const evMap = new Map<string, any>(
    events.map((e: any) => [String(e._id), e])
  );

  const baseUrl =
    process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;

  // 3) Aplanar a nivel boleto/asiento
  const rows: any[] = [];

  for (const o of orders as any[]) {
    const ev = evMap.get(String(o.eventId));
    const eventTitle = ev?.title ?? "";

    // Mapa seatId -> precio
    const priceBySeat = new Map<string, number>();
    for (const it of o.items || []) {
      for (const sid of it.seatIds || []) {
        priceBySeat.set(sid, it.unitPrice ?? 0);
      }
    }

    if (o.tickets && o.tickets.length > 0) {
      // Hay tickets emitidos
      for (const t of o.tickets) {
        const seatId = t.seatId ?? "";
        const price = priceBySeat.get(seatId) ?? 0;
        const pdfUrl = t.ticketId
          ? `${baseUrl}/files/tickets/${t.ticketId}.pdf`
          : null;

        rows.push({
          orderId: String(o._id),
          ticketId: t.ticketId || "",
          eventId: o.eventId,
          eventTitle,
          sessionDate: o.sessionDate ?? null,
          zone: t.zoneId ?? "",
          seatLabel: seatId,
          price,
          status: o.status,
          method: o.method || "stripe",
          createdAt: o.createdAt ?? null,
          paidAt: o.paidAt ?? null,
          pdfUrl,
        });
      }
    } else {
      // Aún no hay tickets: 1 fila por asiento en items[]
      for (const it of o.items || []) {
        for (const seatId of it.seatIds || []) {
          rows.push({
            orderId: String(o._id),
            ticketId: "",
            eventId: o.eventId,
            eventTitle,
            sessionDate: o.sessionDate ?? null,
            zone: it.zoneId ?? "",
            seatLabel: seatId,
            price: it.unitPrice ?? 0,
            status: o.status,
            method: o.method || "stripe",
            createdAt: o.createdAt ?? null,
            paidAt: o.paidAt ?? null,
            pdfUrl: null,
          });
        }
      }
    }
  }

  return res.json({ rows });
};
