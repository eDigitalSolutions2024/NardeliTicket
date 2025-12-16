// src/api/events.ts
import type { EventItem } from "../types/Event";
import { api } from "./client";

// -------- READ --------
export async function fetchEvents(): Promise<EventItem[]> {
  const { data } = await api.get("/events");
  return (data as any[]).map(mapToEventItem);
}

// -------- CREATE --------
export async function createEvent(payload: Partial<EventItem>): Promise<EventItem> {
  const body = toCreateBody(payload);
  const { data } = await api.post("/events", body);
  return mapToEventItem(data);
}

// -------- UPDATE (parcial, sin tocar sesiones si no vienen) --------
export async function updateEvent(id: string, payload: Partial<EventItem>): Promise<EventItem> {
  const body = toUpdateBody(payload);
  const { data } = await api.put(`/events/${id}`, body);
  return mapToEventItem(data);
}

// -------- DELETE --------
export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/events/${id}`);
}

// -------- READ ONE --------
export async function getEvent(id: string): Promise<EventItem> {
  const { data } = await api.get(`/events/${id}`);
  return mapToEventItem(data);
}

// -------- BLOCKED SEATS (sold/active) --------
export async function fetchBlockedSeats(eventId: string): Promise<string[]> {
  const { data } = await api.get(`/events/${eventId}/blocked`);
  return Array.isArray(data?.blocked) ? (data.blocked as string[]) : [];
}

/* ========================
          helpers
   ======================== */

const mapToEventItem = (d: any): EventItem => ({
  id: d._id?.toString?.() ?? d.id,
  title: d.title,
  venue: d.venue,
  city: d.city,
  imageUrl: d.imageUrl,
  category: d.category,
  sessions: (d.sessions ?? []).map((s: any) => ({ id: s._id?.toString?.(), date: s.date })),
  status: d.status ?? "draft",
  featured: Boolean(d.featured),
  pricing: {
    vip: d.pricing?.vip ?? 0,
    oro: d.pricing?.oro ?? 0,
  },
  disabledTables: Array.isArray(d.disabledTables) ? d.disabledTables : [], // 👈 NUEVO
  disabledSeats : Array.isArray(d.disabledSeats) ? d.disabledSeats : [],
});


// Para crear: incluimos todo lo necesario explícitamente
function toCreateBody(p: Partial<EventItem>) {
  const body: any = {
    title: p.title,
    venue: p.venue,
    city: p.city,
    imageUrl: p.imageUrl,
    category: p.category,
    sessions: (p.sessions ?? []).map((s) => ({ date: s.date })),
    status: p.status,
    featured: p.featured,
  };

  if (p.pricing) {
    body.pricing = {
      vip: p.pricing.vip,
      oro: p.pricing.oro,
    };
  }

    if (p.disabledTables) {
    body.disabledTables = p.disabledTables;       // 👈 NUEVO
  }

  if (p.disabledSeats) {
    body.disabledSeats = p.disabledSeats;
  }

  
  return body;
}

// Para actualizar: SOLO enviamos los campos presentes.
// ⚠️ Si NO pasas sessions, NO se mandan y NO se borran en DB.
function toUpdateBody(p: Partial<EventItem>) {
  const body: any = {};
  if (p.title !== undefined) body.title = p.title;
  if (p.venue !== undefined) body.venue = p.venue;
  if (p.city !== undefined) body.city = p.city;
  if (p.imageUrl !== undefined) body.imageUrl = p.imageUrl;
  if (p.category !== undefined) body.category = p.category;
  if (p.status !== undefined) body.status = p.status;
  if (p.featured !== undefined) body.featured = p.featured;

  // ✅ solo si quieres tocar sesiones
  if (p.sessions !== undefined) {
    body.sessions = p.sessions.map((s) => ({ date: s.date }));
  }

  // ✅ IMPORTANTE: mandar precios si vienen
  if (p.pricing && (p.pricing.vip !== undefined || p.pricing.oro !== undefined)) {
    body.pricing = {};
    if (p.pricing.vip !== undefined) body.pricing.vip = Number(p.pricing.vip);
    if (p.pricing.oro !== undefined) body.pricing.oro = Number(p.pricing.oro);
  }

  if (p.disabledTables !== undefined) {
    body.disabledTables = p.disabledTables;   // 👈 NUEVO
  }

  if (p.disabledSeats !== undefined) {
    body.disabledSeats = p.disabledSeats;
  }



  return body;
}
