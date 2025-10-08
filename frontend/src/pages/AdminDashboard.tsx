import { useEffect, useMemo, useState } from "react";
import { createEvent, deleteEvent, fetchEvents, updateEvent } from "../api/events";
import type { EventItem, EventSession } from "../types/Event";

type FormState = Omit<EventItem, "id"> & { id?: string };

const emptyForm: FormState = {
  title: "",
  venue: "",
  city: "",
  imageUrl: "",
  category: undefined,
  sessions: [],
};

export default function AdminDashboard() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEditing = useMemo(() => !!form.id, [form.id]);

  async function load() {
    setLoading(true);
    const data = await fetchEvents();
    setEvents(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addSession(dateISO: string) {
    if (!dateISO) return;
    updateField("sessions", [...form.sessions, { date: dateISO } as EventSession]);
  }
  function removeSession(idx: number) {
    updateField("sessions", form.sessions.filter((_, i) => i !== idx));
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
    } catch (err) {
      console.error(err);
      alert("Error al guardar el evento.");
    } finally {
      setSaving(false);
    }
  }

  function onEdit(ev: EventItem) {
    setForm({
      id: ev.id,
      title: ev.title,
      venue: ev.venue,
      city: ev.city,
      imageUrl: ev.imageUrl,
      category: ev.category,
      sessions: ev.sessions ?? [],
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

  return (
    <div>
      <h1 style={{ margin: "16px 0" }}>Panel de administrador</h1>

      {/* FORM */}
      <form onSubmit={onSubmit} className="admin-form">
        <div className="grid">
          <label>
            Título *
            <input
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Nombre del evento"
              required
            />
          </label>
          <label>
            Venue *
            <input value={form.venue} onChange={(e) => updateField("venue", e.target.value)} placeholder="Ej. Autódromo" required />
          </label>
          <label>
            Ciudad *
            <input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="CDMX / Monterrey / ..." required />
          </label>
          <label>
            Imagen (URL) *
            <input value={form.imageUrl} onChange={(e) => updateField("imageUrl", e.target.value)} placeholder="https://..." required />
          </label>
          <label>
            Categoría
            <select value={form.category ?? ""} onChange={(e) => updateField("category", (e.target.value || undefined) as any)}>
              <option value="">(sin categoría)</option>
              <option>Conciertos</option>
              <option>Teatro</option>
              <option>Deportes</option>
              <option>Familiares</option>
              <option>Especiales</option>
            </select>
          </label>
        </div>

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
            <button
              type="button"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>(".sessions-add input[type='datetime-local']");
                if (el?.value) {
                  addSession(new Date(el.value).toISOString());
                  el.value = "";
                }
              }}
            >
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
          {isEditing && (
            <button type="button" onClick={() => setForm(emptyForm)} className="btn-secondary">Cancelar</button>
          )}
        </div>
      </form>

      {/* LISTADO */}
      <h2 style={{ marginTop: 24 }}>Eventos</h2>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const next = ev.sessions?.[0]?.date ? new Date(ev.sessions[0].date).toLocaleString("es-MX") : "-";
              return (
                <tr key={ev.id}>
                  <td><img src={ev.imageUrl} alt={ev.title} style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 6 }} /></td>
                  <td>{ev.title}</td>
                  <td>{ev.venue}</td>
                  <td>{ev.city}</td>
                  <td>{next}</td>
                  <td style={{ textAlign: "right" }}>
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
