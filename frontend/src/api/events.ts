import axios from "axios";
import type { EventItem } from "../types/Event";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  timeout: 8000,
});

export type EventFilters = { q?: string; city?: string; when?: "all"|"week"|"month" };

const mapToEventItem = (d: any): EventItem => ({
  id: d._id?.toString?.() ?? d.id,
  title: d.title,
  venue: d.venue,
  city: d.city,
  imageUrl: d.imageUrl,
  category: d.category,
  sessions: Array.isArray(d.sessions)
    ? d.sessions.map((s: any) => ({ id: s._id?.toString?.() ?? s.id, date: s.date }))
    : [],
});

export async function fetchEvents(filters: EventFilters = {}): Promise<EventItem[]> {
  try {
    const { data } = await api.get("/api/events", { params: filters });
    return (data as any[]).map(mapToEventItem);
  } catch {
    // si falla, puedes retornar mock si quieres (omitido aquí para admin)
    return [];
  }
}

export async function getEvent(id: string): Promise<EventItem> {
  const { data } = await api.get(`/api/events/${id}`);
  return mapToEventItem(data);
}

export async function createEvent(payload: Partial<EventItem>): Promise<EventItem> {
  const body = {
    title: payload.title,
    venue: payload.venue,
    city: payload.city,
    imageUrl: payload.imageUrl,
    category: payload.category,
    sessions: (payload.sessions ?? []).map((s) => ({ date: s.date })),
  };
  const { data } = await api.post("/api/events", body);
  return mapToEventItem(data);
}

export async function updateEvent(id: string, payload: Partial<EventItem>): Promise<EventItem> {
  const body: any = { ...payload };
  if (payload.sessions) body.sessions = payload.sessions.map((s) => ({ date: s.date }));
  const { data } = await api.put(`/api/events/${id}`, body);
  return mapToEventItem(data);
}

export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/api/events/${id}`);
}
