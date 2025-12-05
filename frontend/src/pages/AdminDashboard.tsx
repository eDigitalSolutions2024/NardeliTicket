// src/pages/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { createEvent, deleteEvent, fetchEvents, updateEvent } from "../api/events";
import type { EventItem, EventSession, EventStatus } from "../types/Event";
import { fetchSales, type TicketSale, type SalesQuery } from "../api/admin";
import "../CSS/adminDashboard.css";

/* ==== helpers UI ==== */
function money(n = 0) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2 });
}
function statusLabel(s: string) {
  const map: Record<string, string> = {
    paid: "Pagado",
    pending: "Pendiente",
    pending_payment: "Pendiente de pago",
    requires_payment: "Requiere pago",
    canceled: "Cancelado",
    expired: "Expirado",
    failed: "Fallido",
    refunded: "Reembolsado",
  };
  return map[s] ?? s;
}

/* ==== API base (frontend -> backend) ==== */
const API =
  ((import.meta as any).env?.VITE_API_URL
    ? `${(import.meta as any).env.VITE_API_URL}/api`
    : "http://localhost:4000/api");

/* ==== dirección fija del salón ==== */
const FIXED_VENUE = "Av. Waterfill 431, Waterfill Río Bravo, 32380"; // <- cámbialo si quieres
const FIXED_CITY = "Ciudad Juárez, Chihuahua, México"; // <- cámbialo si quieres

/* ==== tipos/estado del form ==== */
// Incluimos disabledTables en el estado del form
type FormState = Omit<EventItem, "id"> & { id?: string };
const emptyForm: FormState = {
  title: "",
  venue: FIXED_VENUE,
  city: FIXED_CITY,
  imageUrl: "",
  category: undefined,
  sessions: [],
  status: "draft",
  featured: false,
  pricing: { vip: 0, oro: 0 },
  disabledTables: [],
};

/* ==== utils fechas ==== */
const toISO = (local: string) => new Date(local).toISOString();
const isFuture = (iso: string) => new Date(iso).getTime() >= Date.now();
const sortAsc = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();
const uniqueISO = (list: string[]) => Array.from(new Set(list));

function normalizeSessions(arr: EventSession[]): EventSession[] {
  const isoList = arr
    .map((s) => (typeof s.date === "string" ? s.date : new Date(s.date).toISOString()))
    .filter(Boolean);
  const clean = uniqueISO(isoList).sort(sortAsc);
  return clean.map((d) => ({ date: d }));
}
function nextFuture(sessions: EventSession[]): string | null {
  const futures = (sessions ?? [])
    .map((s) => s.date)
    .filter((d) => isFuture(d))
    .sort(sortAsc);
  return futures[0] ?? null;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"events" | "sales">("events");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [sessionInput, setSessionInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  // layout modal (mesas deshabilitadas)
  const [showLayoutModal, setShowLayoutModal] = useState(false);

  // 👇 nuevos estados para imagen
  const [imageMode, setImageMode] = useState<"url" | "file">("url");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isEditing = !!form.id;

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await fetchEvents();
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // subir imagen al backend y obtener URL
  async function uploadImageFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API}/admin/upload-event-image`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      console.error("Upload error status:", res.status, res.statusText);
      throw new Error("No se pudo subir la imagen");
    }

    const data = await res.json();
    if (!data.url) {
      throw new Error("Respuesta inválida al subir imagen");
    }

    return data.url;
  }

  // sesiones
  function addSessionFromInput() {
    if (!sessionInput) return;
    const iso = toISO(sessionInput);
    const merged = normalizeSessions([...form.sessions, { date: iso }]);
    setField("sessions", merged);
    setSessionInput("");
  }
  function removeSession(idx: number) {
    const copy = [...form.sessions];
    copy.splice(idx, 1);
    setField("sessions", normalizeSessions(copy));
  }

  // submit
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title) {
      alert("Falta el título del evento.");
      return;
    }

    // Validación de imagen: ya sea URL o archivo
    if (imageMode === "url" && !form.imageUrl) {
      alert("Debes proporcionar la URL de la imagen.");
      return;
    }
    if (imageMode === "file" && !imageFile && !form.imageUrl) {
      alert("Debes seleccionar un archivo de imagen.");
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = form.imageUrl;

      // Si el modo es archivo y hay archivo, primero lo subimos
      if (imageMode === "file" && imageFile) {
        setUploadingImage(true);
        try {
          finalImageUrl = await uploadImageFile(imageFile);
        } finally {
          setUploadingImage(false);
        }
      }

      if (!finalImageUrl) {
        alert("No se pudo obtener la URL de la imagen.");
        return;
      }

      const cleanForm: FormState = {
        ...form,
        imageUrl: finalImageUrl,
        venue: FIXED_VENUE,
        city: FIXED_CITY,
        sessions: normalizeSessions(form.sessions),
        status: (form.status ?? "draft") as "draft" | "published",
        pricing: {
          vip: Number(form.pricing?.vip ?? 0),
          oro: Number(form.pricing?.oro ?? 0),
        },
        disabledTables: form.disabledTables ?? [],
      };

      if (isEditing && form.id) {
        const saved = await updateEvent(form.id, cleanForm);
        setEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      } else {
        const saved = await createEvent(cleanForm);
        setEvents((list) => [saved, ...list]);
      }

      setForm(emptyForm);
      setSessionInput("");
      setImageMode("url");
      setImageFile(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      alert("Error al guardar el evento.");
    } finally {
      setSaving(false);
    }
  }

  // acciones
  function onEdit(ev: EventItem) {
    setForm({
      id: ev.id,
      title: ev.title,
      venue: FIXED_VENUE,
      city: FIXED_CITY,
      imageUrl: ev.imageUrl,
      category: ev.category,
      sessions: normalizeSessions(ev.sessions ?? []),
      status: (ev.status ?? "draft") as EventStatus,
      featured: Boolean(ev.featured),
      pricing: { vip: ev.pricing?.vip ?? 0, oro: ev.pricing?.oro ?? 0 },
      disabledTables: ev.disabledTables ?? [],
      createdAt: ev.createdAt,
    });
    setSessionInput("");
    setImageMode("url");
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      await deleteEvent(id);
      setEvents((list) => list.filter((x) => x.id !== id));
      if (form.id === id) {
        setForm(emptyForm);
        setSessionInput("");
      }
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar.");
    }
  }

  async function togglePublish(ev: EventItem) {
    const next: EventStatus = ev.status === "published" ? "draft" : "published";
    setEvents((list) => list.map((x) => (x.id === ev.id ? { ...x, status: next } : x)));
    if (form.id === ev.id) setField("status", next);
    try {
      const saved = await updateEvent(ev.id, { status: next });
      setEvents((list) => list.map((x) => (x.id === ev.id ? saved : x)));
      if (form.id === ev.id) setField("status", (saved.status ?? "draft") as EventStatus);
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado.");
      const rollback = ev.status;
      setEvents((list) => list.map((x) => (x.id === ev.id ? { ...x, status: rollback } : x)));
      if (form.id === ev.id) setField("status", rollback);
    }
  }

  async function toggleFeatured(ev: EventItem) {
    try {
      const saved = await updateEvent(ev.id, { featured: !ev.featured });
      setEvents((list) => list.map((x) => (x.id === ev.id ? saved : x)));
      if (form.id === ev.id) setField("featured", !!saved.featured);
    } catch (e) {
      console.error(e);
      alert("No se pudo marcar como destacado.");
    }
  }

  // búsqueda
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
    <div className="page-admin">
      <h1 style={{ margin: "16px 0" }}>Panel de administrador</h1>

      {/* TABS */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === "events" ? "active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          Eventos
        </button>
        <button
          className={`tab ${activeTab === "sales" ? "active" : ""}`}
          onClick={() => setActiveTab("sales")}
        >
          Ventas / Boletos
        </button>
      </div>

      {activeTab === "events" ? (
        <>
          {/* FORM */}
          <form onSubmit={onSubmit} className="admin-form">
            <div className="grid">
              <label>
                Título *
                <input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Nombre del evento"
                  required
                />
              </label>

              <label>
                Direccion
                <input value={FIXED_VENUE} disabled />
              </label>

              <label>
                Ciudad
                <input value={FIXED_CITY} disabled />
              </label>

              <label>
                Imagen *
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="radio"
                      name="imageMode"
                      value="url"
                      checked={imageMode === "url"}
                      onChange={() => setImageMode("url")}
                    />
                    URL
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="radio"
                      name="imageMode"
                      value="file"
                      checked={imageMode === "file"}
                      onChange={() => setImageMode("file")}
                    />
                    Archivo
                  </label>
                </div>

                {imageMode === "url" ? (
                  <input
                    value={form.imageUrl}
                    onChange={(e) => setField("imageUrl", e.target.value)}
                    placeholder="https://..."
                  />
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setImageFile(file);
                    }}
                  />
                )}
              </label>

              <label>
                Categoría
                <select
                  value={form.category ?? ""}
                  onChange={(e) =>
                    setField("category", (e.target.value || undefined) as any)
                  }
                >
                  <option value="">(sin categoría)</option>
                  <option value="Conciertos">Conciertos</option>
                  <option value="Teatro">Teatro</option>
                  <option value="Deportes">Deportes</option>
                  <option value="Familiares">Familiares</option>
                  <option value="Especiales">Especiales</option>
                </select>
              </label>

              <label>
                Estado
                <select
                  value={form.status ?? "draft"}
                  onChange={(e) => setField("status", e.target.value as EventStatus)}
                >
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                </select>
              </label>

              <label>
                Precio VIP
                <input
                  type="number"
                  min={0}
                  value={form.pricing?.vip ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pricing: { ...(f.pricing ?? {}), vip: Number(e.target.value) },
                    }))
                  }
                  placeholder="0"
                />
              </label>

              <label>
                Precio Oro
                <input
                  type="number"
                  min={0}
                  value={form.pricing?.oro ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pricing: { ...(f.pricing ?? {}), oro: Number(e.target.value) },
                    }))
                  }
                  placeholder="0"
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!form.featured}
                  onChange={(e) => setField("featured", e.target.checked)}
                />
                Destacado
              </label>
            </div>

            {(imageFile || form.imageUrl) && (
              <div style={{ marginTop: 8 }}>
                <small>Preview:</small>
                <div
                  style={{
                    width: 320,
                    height: 180,
                    overflow: "hidden",
                    borderRadius: 8,
                    border: "1px solid #e6e8ef",
                  }}
                >
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : form.imageUrl}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              </div>
            )}

            {/* Sesiones */}
            <div className="sessions">
              <strong>Sesiones / Fechas</strong>
              <div className="sessions-add">
                <input
                  type="datetime-local"
                  value={sessionInput}
                  onChange={(e) => setSessionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSessionFromInput();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addSessionFromInput}
                >
                  Agregar fecha
                </button>
              </div>

              {form.sessions.length > 0 && (
                <ul className="sessions-list">
                  {form.sessions.map((s, i) => (
                    <li key={i}>
                      {new Date(s.date).toLocaleString("es-MX")}
                      <button
                        type="button"
                        onClick={() => removeSession(i)}
                        className="btn-danger"
                        style={{ marginLeft: 8, padding: "4px 8px" }}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Layout / Mesas deshabilitadas */}
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>Layout del salón</strong>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Selecciona las mesas que NO se podrán vender para este evento.
                </span>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowLayoutModal(true)}
                >
                  Configurar layout (mesas)
                </button>
                {form.disabledTables && form.disabledTables.length > 0 ? (
                  <small style={{ color: "#374151" }}>
                    Mesas deshabilitadas:{" "}
                    <strong>{form.disabledTables.join(", ")}</strong>
                  </small>
                ) : (
                  <small style={{ color: "#6b7280" }}>
                    No hay mesas deshabilitadas.
                  </small>
                )}
              </div>
            </div>

            <div
              className="form-actions"
              style={{ marginTop: 12, display: "flex", gap: 8 }}
            >
              <button
                type="submit"
                disabled={saving || uploadingImage}
                className="btn"
              >
                {isEditing ? "Guardar cambios" : "Crear evento"}
              </button>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setSessionInput("");
                    setImageMode("url");
                    setImageFile(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {/* BUSCADOR */}
          <div className="searchbar">
            <h2 style={{ margin: 0 }}>Eventos</h2>
            <input
              placeholder="Buscar por título / venue / ciudad..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* LISTA */}
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div className="overflow-x" style={{ marginTop: 12 }}>
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
                    const next = nextFuture(ev.sessions ?? []);
                    return (
                      <tr key={ev.id}>
                        <td>
                          <img
                            src={ev.imageUrl}
                            alt={ev.title}
                            style={{
                              width: 80,
                              height: 45,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                          />
                        </td>
                        <td>{ev.title}</td>
                        <td>{ev.venue}</td>
                        <td>{ev.city}</td>
                        <td>
                          {next ? new Date(next).toLocaleString("es-MX") : "-"}
                        </td>
                        <td>
                          <button
                            onClick={() => togglePublish(ev)}
                            className="btn-secondary"
                            style={{ padding: "6px 10px" }}
                          >
                            {ev.status === "published"
                              ? "Publicado"
                              : "Borrador"}
                          </button>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!ev.featured}
                            onChange={() => toggleFeatured(ev)}
                          />
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <button
                            onClick={() => onEdit(ev)}
                            className="btn-secondary"
                          >
                            Editar
                          </button>{" "}
                          <button
                            onClick={() => onDelete(ev.id)}
                            className="btn-danger"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {showLayoutModal && (
            <LayoutEditorModal
              disabledTables={form.disabledTables ?? []}
              onChange={(next) => setField("disabledTables", next)}
              onClose={() => setShowLayoutModal(false)}
            />
          )}
        </>
      ) : (
        <SalesTab events={events} />
      )}
    </div>
  );
}

/* =========================
   Pestaña Ventas / Boletos
   ========================= */
function SalesTab({ events }: { events: EventItem[] }) {
  // filtros
  const [from, setFrom] = useState<string>(() =>
    new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 16)
  );
  const [to, setTo] = useState<string>(() =>
    new Date(Date.now() + 1 * 864e5).toISOString().slice(0, 16)
  );
  const [eventId, setEventId] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [status, setStatus] = useState<string>(""); // "" = Todos

  // datos
  const [rows, setRows] = useState<TicketSale[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sum, setSum] = useState<number>(0);

  async function load() {
    setLoading(true);
    try {
      const query: SalesQuery = {
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        eventId: eventId || undefined,
        q: q || undefined,
        status: status || undefined, // si "" no se envía
      };
      const res = await fetchSales(query);
      setRows(res.rows);
      setSum(
        res.totalAmount ??
          res.rows.reduce((a, r) => a + (r.price ?? 0), 0)
      );
    } catch (e) {
      console.error(e);
      alert("No se pudieron cargar las ventas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCount = rows.length;

  // helpers UI filtros rápidos
  function setQuickDays(days: number) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - days);
    const toLocal = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    setFrom(toLocal(start));
    setTo(toLocal(now));
  }
  function setAllTime() {
    const toLocal = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    setFrom(toLocal(new Date(2020, 0, 1)));
    setTo(toLocal(new Date()));
  }
  function resetFilters() {
    setQuickDays(7);
    setEventId("");
    setStatus("");
    setQ("");
  }

  function exportCSV() {
    const header = [
      "FechaCompra",
      "Evento",
      "Sesion",
      "Zona",
      "Asiento",
      "TicketId",
      "Precio",
      "Estado",
      "Usuario",
      "Email",
      "Telefono",
      "OrderId",
      "Metodo",
    ];
    const lines = rows.map((r) =>
      [
        new Date(r.paidAt || r.createdAt || "").toLocaleString("es-MX"),
        csv(r.eventTitle),
        csv(
          r.sessionDate
            ? new Date(r.sessionDate).toLocaleString("es-MX")
            : ""
        ),
        csv(r.zone),
        csv(r.seatLabel || r.seatNumber || ""),
        csv(r.ticketId),
        String(r.price ?? 0),
        csv(statusLabel(r.status)),
        csv(r.userName || ""),
        csv(r.userEmail || ""),
        csv(r.userPhone || ""),
        csv(r.orderId || ""),
        csv(r.method || "stripe"),
      ].join(",")
    );
    const blob = new Blob([header.join(",") + "\n" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const csv = (s?: string) =>
    `"${String(s ?? "").replace(/"/g, '""')}"`;

  return (
    <div>
      <h2 style={{ margin: "8px 0 16px" }}>Ventas / Boletos</h2>

      {/* Filtros mejorados */}
      <div className="filter-bar">
        {/* Rango */}
        <div className="field range">
          <label>Rango</label>
          <div className="range-box">
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Desde"
            />
            <span className="sep">→</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Hasta"
            />
          </div>
          <div className="quick">
            <button type="button" onClick={() => setQuickDays(0)}>
              Hoy
            </button>
            <button type="button" onClick={() => setQuickDays(7)}>
              7d
            </button>
            <button type="button" onClick={() => setQuickDays(30)}>
              30d
            </button>
            <button type="button" onClick={setAllTime}>
              Todo
            </button>
          </div>
        </div>

        {/* Evento */}
        <div className="field">
          <label>Evento</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">Todos</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div className="field">
          <label>Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="pending">
              Pendiente (pending / pending_payment /
              requires_payment)
            </option>
            <option value="pending_payment">Pendiente de pago</option>
            <option value="requires_payment">Requiere pago</option>
            <option value="paid">Pagado</option>
            <option value="canceled">Cancelado</option>
            <option value="expired">Expirado</option>
            <option value="failed">Fallido</option>
          </select>
        </div>

        {/* Buscar */}
        <div className="field grow">
          <label>Buscar (usuario / ticket / zona / asiento)</label>
          <div className="input-icon">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <path d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 0 0 1.57-4.23 6.5 6.5 0 1 0-6.5 6.5 6.471 6.471 0 0 0 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej. 656..., VIP, A-12, ticketId..."
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="actions">
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Aplicar filtros"}
          </button>
          <button
            className="btn-secondary"
            onClick={exportCSV}
            disabled={!rows.length}
          >
            Exportar CSV
          </button>
          <button className="btn-ghost" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <div className="kpi">
          <div className="label">Boletos</div>
          <div className="value">{String(totalCount)}</div>
        </div>
        <div className="kpi">
          <div className="label">Ingreso</div>
          <div className="value">$ {money(sum)}</div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Fecha compra</th>
              <th>Evento</th>
              <th>Sesión</th>
              <th>Zona</th>
              <th>Asiento</th>
              <th>Ticket</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Usuario</th>
              <th>Contacto</th>
              <th>Order</th>
              <th>Método</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={
                  r.ticketId ||
                  `${r.orderId}-${r.seatLabel || r.seatNumber || i}`
                }
              >
                <td>
                  {new Date(
                    r.paidAt || r.createdAt || ""
                  ).toLocaleString("es-MX")}
                </td>
                <td>{r.eventTitle}</td>
                <td>
                  {r.sessionDate
                    ? new Date(r.sessionDate).toLocaleString("es-MX")
                    : "-"}
                </td>
                <td>{r.zone || "-"}</td>
                <td>{r.seatLabel || r.seatNumber || "-"}</td>
                <td>{r.ticketId}</td>
                <td>${money(r.price ?? 0)}</td>
                <td>
                  <span
                    className={`badge status--${(r.status || "").toLowerCase()}`}
                  >
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td>{r.userName || "-"}</td>
                <td>
                  {r.userEmail || "-"}
                  {r.userPhone ? (
                    <div style={{ color: "#666" }}>{r.userPhone}</div>
                  ) : null}
                </td>
                <td>{r.orderId || "-"}</td>
                <td>{r.method || "stripe"}</td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={12} style={{ textAlign: "center" }}>
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   Modal para configurar layout
   ========================= */

type LayoutEditorModalProps = {
  disabledTables: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
};

function LayoutEditorModal({
  disabledTables,
  onChange,
  onClose,
}: LayoutEditorModalProps) {
  type LayoutTable = {
    id: string;
    zoneId: "VIP" | "ORO";
    cx: number;
    cy: number;
    label: string;
  };

  const numToLetter = (n: number) =>
    String.fromCharCode("A".charCodeAt(0) + (n - 1));

  // Geometría simplificada basada en SeatSelectionPage
  const tables: LayoutTable[] = useMemo(() => {
    const out: LayoutTable[] = [];

    // Constantes aproximadas del mapa grande
    
    const STEP_X = 340;
    const STEP_Y = 250;

    // VIP (izquierda) 3x5
    const vipOrigin = { x: 260, y: 300 };
    let tVip = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        tVip++;
        const id = `VIP-${String(tVip).padStart(2, "0")}`;
        const cx = vipOrigin.x + c * STEP_X;
        const cy = vipOrigin.y + r * STEP_Y;
        const letter = numToLetter(tVip);
        out.push({
          id,
          zoneId: "VIP",
          cx,
          cy,
          label: `VIP-${letter}`,
        });
      }
    }

    // ORO (derecha) 5x5
    const oroOrigin = { x: 1350, y: 300 };
    let tOro = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        tOro++;
        const id = `ORO-${String(tOro).padStart(2, "0")}`;
        const cx = oroOrigin.x + c * STEP_X;
        const cy = oroOrigin.y + r * STEP_Y;
        const letter = numToLetter(tOro);
        out.push({
          id,
          zoneId: "ORO",
          cx,
          cy,
          label: `ORO-${letter}`,
        });
      }
    }

    return out;
  }, []);

  const [localDisabled, setLocalDisabled] = useState<Set<string>>(
    () => new Set(disabledTables)
  );

  const toggleTable = (id: string) => {
    setLocalDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    onChange(Array.from(localDisabled));
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#0b1220",
          color: "#e5e7eb",
          borderRadius: 14,
          border: "1px solid #1f2937",
          maxWidth: "1200px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>
            Configurar layout del evento
          </h2>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            Haz clic en una mesa para habilitarla o deshabilitarla.
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              borderRadius: 999,
              padding: "4px 10px",
              border: "1px solid #374151",
              background: "#111827",
              color: "#e5e7eb",
              cursor: "pointer",
            }}
          >
            Cerrar ✕
          </button>
        </header>

        <div style={{ padding: 12, flex: 1, overflow: "auto" }}>
          <svg
            viewBox="0 0 3000 1600"
            style={{ width: "100%", maxHeight: 600 }}
          >
            {/* Stage */}
            <g transform="translate(40, 520)">
              <rect x="0" y="-190" width="88" height="380" fill="#111" rx="10" />
              <text
                x="44"
                y="0"
                fill="#e5e7eb"
                fontSize="20"
                textAnchor="middle"
                transform="rotate(-90 44,0)"
              >
                STAGE
              </text>
            </g>

            {/* Marcos zona VIP / ORO */}
            <rect
              x="100"
              y="120"
              width="1025"
              height="1400"
              fill="none"
              stroke="#1e62ff"
              strokeWidth={14}
              rx={20}
            />
            <g transform="translate(140, 205)">
              <text
                x="200"
                y="-105"
                fill="#e5e7eb"
                fontSize={34}
                fontWeight={900}
              >
                ZONA VIP — 15 mesas
              </text>
            </g>

            <rect
              x="1150"
              y="120"
              width="1800"
              height="1400"
              fill="none"
              stroke="#d4af37"
              strokeWidth={14}
              rx={20}
            />
            <g transform="translate(1420, 205)">
              <text
                x="400"
                y="-105"
                fill="#e5e7eb"
                fontSize={34}
                fontWeight={900}
              >
                ZONA ORO — 25 mesas
              </text>
            </g>

            {/* Mesas */}
            {tables.map((t) => {
              const isDisabled = localDisabled.has(t.id);
              const TABLE_W = 190;
              const TABLE_H = 120;
              const TABLE_R = 18;

              const strokeBase = t.zoneId === "VIP" ? "#1e62ff" : "#d4af37";

              return (
                <g
                  key={t.id}
                  onClick={() => toggleTable(t.id)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={t.cx - TABLE_W / 2}
                    y={t.cy - TABLE_H / 2}
                    width={TABLE_W}
                    height={TABLE_H}
                    rx={TABLE_R}
                    ry={TABLE_R}
                    fill={isDisabled ? "#111827" : "#e9eef7"}
                    stroke={isDisabled ? "#ef4444" : strokeBase}
                    strokeWidth={isDisabled ? 6 : 3}
                    opacity={isDisabled ? 0.75 : 1}
                  />
                  <text
                    x={t.cx}
                    y={t.cy + 8}
                    fontSize={30}
                    textAnchor="middle"
                    fill={isDisabled ? "#fca5a5" : "#334155"}
                    style={{
                      pointerEvents: "none",
                      fontWeight: 900,
                      letterSpacing: 0.6,
                    }}
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}

            {/* Leyenda */}
            <g transform="translate(140, 1560)">
              <rect
                x="0"
                y="-34"
                width="720"
                height="52"
                fill="#0f1629"
                rx="12"
              />
              <line
                x1="20"
                y1="-10"
                x2="80"
                y2="-10"
                stroke="#22c55e"
                strokeWidth={10}
              />
              <text x="92" y="-3" fill="#e5e7eb" fontSize={18}>
                Mesa habilitada (a la venta)
              </text>
              <line
                x1="360"
                y1="-10"
                x2="420"
                y2="-10"
                stroke="#ef4444"
                strokeWidth={10}
              />
              <text x="432" y="-3" fill="#e5e7eb" fontSize={18}>
                Mesa deshabilitada
              </text>
            </g>
          </svg>
        </div>

        <footer
          style={{
            padding: 12,
            borderTop: "1px solid #1f2937",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            Mesas deshabilitadas:{" "}
            {localDisabled.size
              ? Array.from(localDisabled).join(", ")
              : "ninguna"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setLocalDisabled(new Set())}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #4b5563",
                background: "#111827",
                color: "#e5e7eb",
                cursor: "pointer",
              }}
            >
              Limpiar
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#22c55e",
                color: "#0b1120",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Guardar layout
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
