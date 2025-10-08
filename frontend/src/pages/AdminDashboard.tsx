import { useEffect, useMemo, useState } from "react";
import { createEvent, deleteEvent, fetchEvents, updateEvent } from "../api/events";
import type { EventItem, EventSession, EventStatus } from "../types/Event";

type FormState = Omit<EventItem, "id"> & { id?: string };
const emptyForm: FormState = {
  title: "", venue: "", city: "", imageUrl: "",
  category: undefined, sessions: [], status: "draft", featured: false,
};

export default function AdminDashboard() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const isEditing = useMemo(() => !!form.id, [form.id]);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const data = await fetchEvents();
    setEvents(data);
    setLoading(false);
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function addSession(dateISO: string) {
    if (!dateISO) return;
    setField("sessions", [...form.sessions, { date: dateISO }]);
  }
  function removeSession(i: number) {
    setField("sessions", form.sessions.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.venue || !form.city || !form.imageUrl) {
      alert("Faltan campos obligatorios (título, venue, ciudad, imagen).");
      return;
    }
    setSaving(true);
    try {
      if (isEditing && form.id) {
        const saved = await updateEvent(form.id, form);
        setEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      } else {
        const saved = await createEvent(form);
        setEvents((list) => [saved, ...list]);
      }
      setForm(emptyForm);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      alert("Error al guardar el evento.");
    } finally {
      setSaving(false);
    }
  }

  function onEdit(ev: EventItem) {
    setForm({
      id: ev.id, title: ev.title, venue: ev.venue, city: ev.city, imageUrl: ev.imageUrl,
      category: ev.category, sessions: ev.sessions ?? [], status: ev.status ?? "draft",
      featured: Boolean(ev.featured),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      await deleteEvent(id);
      setEvents((list) => list.filter((x) => x.id !== id));
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar.");
    }
  }
  async function togglePublish(ev: EventItem) {
    try {
      const next: EventStatus = ev.status === "published" ? "draft" : "published";
      const saved = await updateEvent(ev.id, { status: next });
      setEvents((list) => list.map((x) => (x.id === ev.id ? saved : x)));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado.");
    }
  }
  async function toggleFeatured(ev: EventItem) {
    try {
      const saved = await updateEvent(ev.id, { featured: !ev.featured });
      setEvents((list) => list.map((x) => (x.id === ev.id ? saved : x)));
    } catch (e) {
      console.error(e);
      alert("No se pudo marcar como destacado.");
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(s) ||
        e.venue.toLowerCase().includes(s) ||
        e.city.toLowerCase().includes(s)
    );
  }, [events, q]);

  return (
    <div>
      <h1 style={{ margin: "16px 0" }}>Panel de administrador</h1>

      {/* FORM */}
      <form onSubmit={onSubmit} className="admin-form">
        <div className="grid">
          <label>
            Título *
            <input value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Nombre del evento" required />
          </label>
          <label>
            Venue *
            <input value={form.venue} onChange={(e) => setField("venue", e.target.value)} placeholder="Ej. Autódromo" required />
          </label>
          <label>
            Ciudad *
            <input value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="CDMX / Monterrey / ..." required />
          </label>
          <label>
            Imagen (URL) *
            <input value={form.imageUrl} onChange={(e) => setField("imageUrl", e.target.value)} placeholder="https://..." required />
          </label>
          <label>
            Categoría
            <select value={form.category ?? ""} onChange={(e) => setField("category", (e.target.value || undefined) as any)}>
              <option value="">(sin categoría)</option>
              <option>Conciertos</option>
              <option>Teatro</option>
              <option>Deportes</option>
              <option>Familiares</option>
              <option>Especiales</option>
            </select>
          </label>
          <label>
            Estado
            <select value={form.status ?? "draft"} onChange={(e) => setField("status", e.target.value as EventStatus)}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={!!form.featured} onChange={(e) => setField("featured", e.target.checked)} />
            Destacado
          </label>
        </div>

        {/* Preview imagen */}
        {form.imageUrl && (
          <div style={{ marginTop: 8 }}>
            <small>Preview:</small>
            <div style={{ width: 320, height: 180, overflow: "hidden", borderRadius: 8, border: "1px solid #e6e8ef" }}>
              <img src={form.imageUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        )}

        {/* sesiones */}
        <div className="sessions">
          <strong>Sesiones / Fechas</strong>
          <div className="sessions-add">
            <input
              type="datetime-local"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const input = e.target as HTMLInputElement;
                  if (input.value) {
                    addSession(new Date(input.value).toISOString());
                    input.value = "";
                  }
                }
              }}
            />
            <button type="button" onClick={() => {
              const el = document.querySelector<HTMLInputElement>(".sessions-add input[type='datetime-local']");
              if (el?.value) {
                addSession(new Date(el.value).toISOString());
                el.value = "";
              }
            }}>
              Agregar fecha
            </button>
          </div>

          {form.sessions.length > 0 && (
            <ul className="sessions-list">
              {form.sessions.map((s, i) => (
                <li key={i}>
                  {new Date(s.date).toLocaleString("es-MX")}
                  <button type="button" onClick={() => removeSession(i)}>Quitar</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" disabled={saving}>{isEditing ? "Guardar cambios" : "Crear evento"}</button>
          {isEditing && <button type="button" onClick={() => setForm(emptyForm)} className="btn-secondary">Cancelar</button>}
        </div>
      </form>

      {/* BUSCADOR */}
      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Eventos</h2>
        <input
          placeholder="Buscar por título / venue / ciudad..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ height: 36, borderRadius: 8, border: "1px solid #d5dcef", padding: "0 10px", minWidth: 280 }}
        />
      </div>

      {/* LISTA */}
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Título</th>
              <th>Venue</th>
              <th>Ciudad</th>
              <th>Próxima fecha</th>
              <th>Estado</th>
              <th>Dest.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => {
              const next = ev.sessions?.[0]?.date ? new Date(ev.sessions[0].date).toLocaleString("es-MX") : "-";
              return (
                <tr key={ev.id}>
                  <td><img src={ev.imageUrl} alt={ev.title} style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 6 }} /></td>
                  <td>{ev.title}</td>
                  <td>{ev.venue}</td>
                  <td>{ev.city}</td>
                  <td>{next}</td>
                  <td>
                    <button onClick={() => togglePublish(ev)} className="btn-secondary" style={{ padding: "6px 10px" }}>
                      {ev.status === "published" ? "Publicado" : "Borrador"}
                    </button>
                  </td>
                  <td>
                    <input type="checkbox" checked={!!ev.featured} onChange={() => toggleFeatured(ev)} />
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => onEdit(ev)}>Editar</button>{" "}
                    <button onClick={() => onDelete(ev.id)} className="btn-danger">Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
