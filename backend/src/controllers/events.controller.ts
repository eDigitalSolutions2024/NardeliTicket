import { Request, Response } from "express";
import { Event } from "../models/Event";

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
/** POST /api/events */
export async function createEvent(req: Request, res: Response) {
  try {
    const {
      title, venue, city, imageUrl,
      category,
      sessions = [],
      status,           // ⬅️ NUEVO
      featured          // ⬅️ NUEVO
    } = req.body || {};

    if (!title || !venue || !city || !imageUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedSessions = Array.isArray(sessions)
      ? sessions.map((s: any) => ({ date: new Date(s.date ?? s) }))
      : [];

    const ev = await Event.create({
      title,
      venue,
      city,
      imageUrl,
      category,
      sessions: normalizedSessions,
      status,                 // ⬅️ guarda status (Mongoose respeta enum/default)
      featured: !!featured,   // ⬅️ guarda featured
    });

    res.status(201).json(ev);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create event" });
  }
}


/** PUT /api/events/:id */
/** PUT /api/events/:id */
export async function updateEvent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      title, venue, city, imageUrl,
      category, sessions,
      status,           // ⬅️ NUEVO
      featured          // ⬅️ NUEVO
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

    const ev = await Event.findByIdAndUpdate(id, update, { new: true });
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
