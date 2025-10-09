import axios from "axios";
import type { EventItem } from "../types/Event";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  timeout: 8000,
});

// Adjunta el token en TODAS las requests si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export { api }; // por si lo reutilizas

// -------- READ --------
export async function fetchEvents(): Promise<EventItem[]> {
  const { data } = await api.get("/api/events");
  return (data as any[]).map(mapToEventItem);
}

// -------- CREATE --------
export async function createEvent(payload: Partial<EventItem>): Promise<EventItem> {
  const body = toCreateBody(payload);
  const { data } = await api.post("/api/events", body);
  return mapToEventItem(data);
}

// -------- UPDATE (parcial, sin tocar sesiones si no vienen) --------
export async function updateEvent(id: string, payload: Partial<EventItem>): Promise<EventItem> {
  const body = toUpdateBody(payload);
  const { data } = await api.put(`/api/events/${id}`, body);
  return mapToEventItem(data);
}

// -------- DELETE --------
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

// Para crear: incluimos todo lo necesario explícitamente
function toCreateBody(p: Partial<EventItem>) {
  return {
    title: p.title,
    venue: p.venue,
    city: p.city,
    imageUrl: p.imageUrl,
    category: p.category,
    sessions: (p.sessions ?? []).map((s) => ({ date: s.date })),
    status: p.status,
    featured: p.featured,
  };
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
  if (p.sessions !== undefined) {
    body.sessions = p.sessions.map((s) => ({ date: s.date }));
  }
  return body;
}
