import axios from "axios";
import type { EventItem } from "../types/Event";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  timeout: 8000,
});

export async function fetchEvents(): Promise<EventItem[]> {
  const { data } = await api.get("/api/events");
  return (data as any[]).map(mapToEventItem);
}
export async function createEvent(payload: Partial<EventItem>): Promise<EventItem> {
  const body = toBody(payload);
  const { data } = await api.post("/api/events", body);
  return mapToEventItem(data);
}
export async function updateEvent(id: string, payload: Partial<EventItem>): Promise<EventItem> {
  const body = toBody(payload);
  const { data } = await api.put(`/api/events/${id}`, body);
  return mapToEventItem(data);
}
export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/api/events/${id}`);
}

/* helpers */
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
});
const toBody = (p: Partial<EventItem>) => ({
  title: p.title,
  venue: p.venue,
  city: p.city,
  imageUrl: p.imageUrl,
  category: p.category,
  sessions: (p.sessions ?? []).map((s) => ({ date: s.date })),
  status: p.status,
  featured: p.featured,
});
