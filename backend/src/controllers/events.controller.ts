import { Request, Response } from "express";
import { Event } from "../models/Event";
import SeatHold from "../models/SeatHold";


/** GET /api/events */
export async function listEvents(req: Request, res: Response) {
  const { q = "", city = "Todos", when = "all" } = req.query as {
    q?: string; city?: string; when?: "all"|"week"|"month";
  };

  const filter: any = {};
  if (city && city !== "Todos") filter.city = city;
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { venue: { $regex: q, $options: "i" } },
      { city:  { $regex: q, $options: "i" } },
    ];
  }
  if (when !== "all") {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(now.getDate() + (when === "week" ? 7 : 30));
    filter["sessions.date"] = { $lte: limit };
  }

  const events = await Event.find(filter).sort({ "sessions.date": 1 }).lean();
  res.json(events);
}

/** GET /api/events/:id */
export async function getEvent(req: Request, res: Response) {
  const { id } = req.params;
  const ev = await Event.findById(id).lean();
  if (!ev) return res.status(404).json({ error: "Event not found" });
  res.json(ev);
}

/** POST /api/events */
export async function createEvent(req: Request, res: Response) {
  try {
    const {
      title, venue, city, imageUrl,
      category,
      sessions = [],
      status,           // ⬅️ NUEVO
      featured,         // ⬅️ NUEVO
      pricing           // ⬅️ NUEVO { vip, oro }
    } = req.body || {};

    if (!title || !venue || !city || !imageUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedSessions = Array.isArray(sessions)
      ? sessions.map((s: any) => ({ date: new Date(s.date ?? s) }))
      : [];

    // ⬅️ NUEVO: normalizar precios (si no vienen, por defecto 0)
    const normalizedPricing = {
      vip: Number(pricing?.vip ?? 0),
      oro: Number(pricing?.oro ?? 0),
    };

    const ev = await Event.create({
      title,
      venue,
      city,
      imageUrl,
      category,
      sessions: normalizedSessions,
      status,                 // ⬅️ guarda status
      featured: !!featured,   // ⬅️ guarda featured
      pricing: normalizedPricing, // ⬅️ NUEVO
    });

    res.status(201).json(ev);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create event" });
  }
}

/** PUT /api/events/:id */
export async function updateEvent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      title, venue, city, imageUrl,
      category, sessions,
      status,           // ⬅️ NUEVO
      featured,         // ⬅️ NUEVO
      pricing           // ⬅️ NUEVO { vip, oro }
    } = req.body || {};

    const update: any = {};
    if (title !== undefined) update.title = title;
    if (venue !== undefined) update.venue = venue;
    if (city !== undefined) update.city = city;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    if (category !== undefined) update.category = category;

    if (Array.isArray(sessions)) {
      update.sessions = sessions.map((s: any) => ({ date: new Date(s.date ?? s) }));
    }

    if (status !== undefined) update.status = status;        // ⬅️ aplica status
    if (featured !== undefined) update.featured = !!featured;// ⬅️ aplica featured

    // ⬅️ NUEVO: actualización parcial de precios
    if (pricing && (pricing.vip !== undefined || pricing.oro !== undefined)) {
      if (pricing.vip !== undefined) update["pricing.vip"] = Number(pricing.vip);
      if (pricing.oro !== undefined) update["pricing.oro"] = Number(pricing.oro);
    }

    const ev = await Event.findByIdAndUpdate(id, update, { new: true, runValidators: true, upsert: false });
    if (!ev) return res.status(404).json({ error: "Event not found" });
    res.json(ev);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to update event" });
  }
}

/** DELETE /api/events/:id */
export async function deleteEvent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const ev = await Event.findByIdAndDelete(id);
    if (!ev) return res.status(404).json({ error: "Event not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete event" });
  }
}

/** GET /api/events/:eventId/blocked
 *  Devuelve los asientos bloqueados para el evento.
 *  Por defecto bloquea vendidos ("sold") y holds activos ("active").
 *  Si solo quieres vendidos, cambia el $in a ["sold"].
 */
export async function getBlockedSeats(req: Request, res: Response) {
  try {
    const { eventId } = req.params;

    const holds = await SeatHold.find(
      { eventId, status: { $in: ["sold", "active"] } }, // <- ajusta si quieres solo "sold"
      { tableId: 1, seatId: 1, _id: 0 }
    ).lean();

    const blocked = holds.map(h => `${h.tableId}:${h.seatId}`);
    res.json({ blocked });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_get_blocked" });
  }
}

