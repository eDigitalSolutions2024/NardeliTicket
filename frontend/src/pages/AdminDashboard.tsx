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

/* ==== tipos/estado del form ==== */
type FormState = Omit<EventItem, "id"> & { id?: string };
const emptyForm: FormState = {
  title: "",
  venue: "",
  city: "",
  imageUrl: "",
  category: undefined,
  sessions: [],
  status: "draft",
  featured: false,
  pricing: { vip: 0, oro: 0 },
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

    if (!form.title || !form.venue || !form.city || !form.imageUrl) {
      alert("Faltan campos obligatorios (título, venue, ciudad, imagen).");
      return;
    }
    const cleanForm: FormState = {
      ...form,
      sessions: normalizeSessions(form.sessions),
      status: (form.status ?? "draft") as "draft" | "published",
      pricing: {
        vip: Number(form.pricing?.vip ?? 0),
        oro: Number(form.pricing?.oro ?? 0),
      },
    };

    setSaving(true);
    try {
      if (isEditing && form.id) {
        const saved = await updateEvent(form.id, cleanForm);
        setEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      } else {
        const saved = await createEvent(cleanForm);
        setEvents((list) => [saved, ...list]);
      }
      setForm(emptyForm);
      setSessionInput("");
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
      venue: ev.venue,
      city: ev.city,
      imageUrl: ev.imageUrl,
      category: ev.category,
      sessions: normalizeSessions(ev.sessions ?? []),
      status: (ev.status ?? "draft") as EventStatus,
      featured: Boolean(ev.featured),
      pricing: { vip: ev.pricing?.vip ?? 0, oro: ev.pricing?.oro ?? 0 },
    });
    setSessionInput("");
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
                Venue *
                <input
                  value={form.venue}
                  onChange={(e) => setField("venue", e.target.value)}
                  placeholder="Ej. Autódromo"
                  required
                />
              </label>

              <label>
                Ciudad *
                <input
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="CDMX / Monterrey / ..."
                  required
                />
              </label>

              <label>
                Imagen (URL) *
                <input
                  value={form.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                  placeholder="https://..."
                  required
                />
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

            {form.imageUrl && (
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
                    src={form.imageUrl}
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
                <button type="button" className="btn-secondary" onClick={addSessionFromInput}>
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

            <div className="form-actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="btn">
                {isEditing ? "Guardar cambios" : "Crear evento"}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyForm);
                    setSessionInput("");
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
                        <td>{next ? new Date(next).toLocaleString("es-MX") : "-"}</td>
                        <td>
                          <button
                            onClick={() => togglePublish(ev)}
                            className="btn-secondary"
                            style={{ padding: "6px 10px" }}
                          >
                            {ev.status === "published" ? "Publicado" : "Borrador"}
                          </button>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!ev.featured}
                            onChange={() => toggleFeatured(ev)}
                          />
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => onEdit(ev)} className="btn-secondary">Editar</button>{" "}
                          <button onClick={() => onDelete(ev.id)} className="btn-danger">
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
      setSum(res.totalAmount ?? res.rows.reduce((a, r) => a + (r.price ?? 0), 0));
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
      new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFrom(toLocal(start));
    setTo(toLocal(now));
  }
  function setAllTime() {
    const toLocal = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
        csv(r.sessionDate ? new Date(r.sessionDate).toLocaleString("es-MX") : ""),
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
  const csv = (s?: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;

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
            <button type="button" onClick={() => setQuickDays(0)}>Hoy</button>
            <button type="button" onClick={() => setQuickDays(7)}>7d</button>
            <button type="button" onClick={() => setQuickDays(30)}>30d</button>
            <button type="button" onClick={setAllTime}>Todo</button>
          </div>
        </div>

        {/* Evento */}
        <div className="field">
          <label>Evento</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
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
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pending">Pendiente (pending / pending_payment / requires_payment)</option>
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
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
          <button className="btn-secondary" onClick={exportCSV} disabled={!rows.length}>
            Exportar CSV
          </button>
          <button className="btn-ghost" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
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
              <tr key={r.ticketId || `${r.orderId}-${r.seatLabel || r.seatNumber || i}`}>
                <td>{new Date(r.paidAt || r.createdAt || "").toLocaleString("es-MX")}</td>
                <td>{r.eventTitle}</td>
                <td>{r.sessionDate ? new Date(r.sessionDate).toLocaleString("es-MX") : "-"}</td>
                <td>{r.zone || "-"}</td>
                <td>{r.seatLabel || r.seatNumber || "-"}</td>
                <td>{r.ticketId}</td>
                <td>${money(r.price ?? 0)}</td>
                <td>
                  <span className={`badge status--${(r.status || "").toLowerCase()}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td>{r.userName || "-"}</td>
                <td>
                  {r.userEmail || "-"}
                  {r.userPhone ? <div style={{ color: "#666" }}>{r.userPhone}</div> : null}
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
