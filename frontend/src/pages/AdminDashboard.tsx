// src/pages/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { createEvent, deleteEvent, fetchEvents, updateEvent } from "../api/events";
import type { EventItem, EventSession, EventStatus } from "../types/Event";
import { fetchSales, type TicketSale, type SalesQuery } from "../api/admin";
import { api } from "../api/client";
import { buildTables, TABLE_W, TABLE_H, TABLE_R, numToLetter, type TableGeom } from "../layout/salonLayout";
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
  disabledSeats: [],
  admissionType: "seated",
  generalAdmission: { price: 0, capacity: null },
};

/* ==== utils fechas ==== */
const toISO = (local: string) => new Date(local).toISOString();
const isFuture = (iso: string) => new Date(iso).getTime() >= Date.now();
const sortAsc = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();
//const uniqueISO = (list: string[]) => Array.from(new Set(list));

function normalizeSessions(arr: EventSession[]): EventSession[] {
  const byDate = new Map<string, EventSession>();

  for (const s of arr) {
    const iso =
      typeof s.date === "string" ? s.date : new Date(s.date).toISOString();
    if (!iso) continue;

    if (!byDate.has(iso)) {
      byDate.set(iso, {
        id: s.id || crypto.randomUUID(),
        date: iso,
        disabledTables: s.disabledTables ?? [],
        disabledSeats: s.disabledSeats ?? [],
      });
    } else {
      const prev = byDate.get(iso)!;
      byDate.set(iso, {
        id: prev.id || s.id || crypto.randomUUID(),
        date: iso,
        disabledTables: prev.disabledTables?.length ? prev.disabledTables : (s.disabledTables ?? []),
        disabledSeats: prev.disabledSeats?.length ? prev.disabledSeats : (s.disabledSeats ?? []),
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => sortAsc(a.date, b.date));
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

    // Usamos la instancia `api` para que adjunte el token Bearer (y maneje refresh).
    // La subida requiere rol admin en el backend.
    const { data } = await api.post("/admin/upload-event-image", formData);
    if (!data?.url) {
      throw new Error("Respuesta inválida al subir imagen");
    }

    return data.url as string;
  }

  // sesiones
function addSessionFromInput() {
  if (!sessionInput) return;

  const iso = toISO(sessionInput);

  const merged = normalizeSessions([
    ...form.sessions,
    {
      id: crypto.randomUUID(),
      date: iso,
      disabledTables: [],
      disabledSeats: [],
    },
  ]);

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

    // Validación de imagen: se requiere un archivo (o una imagen previa al editar)
    if (!imageFile && !form.imageUrl) {
      alert("Debes seleccionar un archivo de imagen.");
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = form.imageUrl;

      // Si se seleccionó un archivo, lo subimos primero
      if (imageFile) {
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
        disabledSeats: (form as any).disabledSeats ?? [],
        admissionType: form.admissionType ?? "seated",
        generalAdmission: {
          price: Number(form.generalAdmission?.price ?? 0),
          capacity:
            form.generalAdmission?.capacity === null ||
            form.generalAdmission?.capacity === undefined
              ? null
              : Number(form.generalAdmission.capacity),
        },
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
      disabledSeats: (ev as any).disabledSeats ?? [],
      admissionType: ev.admissionType ?? "seated",
      generalAdmission: {
        price: ev.generalAdmission?.price ?? 0,
        capacity: ev.generalAdmission?.capacity ?? null,
      },
      createdAt: ev.createdAt,
    });
    setSessionInput("");
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
    <div className="admin-page-wrapper">
      <div className="page-backdrop" aria-hidden />
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
              <label style={{ gridColumn: "1 / -1" }}>
                Tipo de venta
                <select
                  value={form.admissionType ?? "seated"}
                  onChange={(e) =>
                    setField("admissionType", e.target.value as "seated" | "general")
                  }
                >
                  <option value="seated">Con asientos (mesas / sillas)</option>
                  <option value="general">Admisión general (solo boletos)</option>
                </select>
                <small style={{ color: "#c4b5fd" }}>
                  {form.admissionType === "general"
                    ? "El cliente elige cuántos boletos comprar, sin mapa de asientos."
                    : "El cliente elige asientos en el layout del salón."}
                </small>
              </label>

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
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                  }}
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

              {form.admissionType !== "general" && (
                <>
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
                </>
              )}

              {form.admissionType === "general" && (
                <>
                  <label>
                    Precio del boleto
                    <input
                      type="number"
                      min={0}
                      value={form.generalAdmission?.price ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          generalAdmission: {
                            price: Number(e.target.value),
                            capacity: f.generalAdmission?.capacity ?? null,
                          },
                        }))
                      }
                      placeholder="0"
                    />
                  </label>

                  <label>
                    Cupo (boletos disponibles)
                    <input
                      type="number"
                      min={0}
                      value={
                        form.generalAdmission?.capacity === null ||
                        form.generalAdmission?.capacity === undefined
                          ? ""
                          : form.generalAdmission.capacity
                      }
                      disabled={
                        form.generalAdmission?.capacity === null ||
                        form.generalAdmission?.capacity === undefined
                      }
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          generalAdmission: {
                            price: f.generalAdmission?.price ?? 0,
                            capacity: e.target.value === "" ? null : Number(e.target.value),
                          },
                        }))
                      }
                      placeholder="Sin límite"
                    />
                    <label
                      style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontWeight: 400 }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          form.generalAdmission?.capacity === null ||
                          form.generalAdmission?.capacity === undefined
                        }
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            generalAdmission: {
                              price: f.generalAdmission?.price ?? 0,
                              capacity: e.target.checked ? null : 0,
                            },
                          }))
                        }
                      />
                      <span style={{ fontSize: 13 }}>Sin límite de cupo</span>
                    </label>
                  </label>
                </>
              )}

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
                <small style={{ color: "#c4b5fd" }}>Preview:</small>
                <div
                  style={{
                    width: 320,
                    height: 180,
                    overflow: "hidden",
                    borderRadius: 8,
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(0, 0, 0, 0.25)",
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

            {/* Layout / Mesas deshabilitadas (solo eventos con asientos) */}
            {form.admissionType !== "general" && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                border: "1px solid rgba(168, 85, 247, 0.3)",
                background: "rgba(124, 58, 237, 0.12)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ color: "#f3effd" }}>Layout del salón</strong>
                <span style={{ fontSize: 12, color: "#c4b5fd" }}>
                  Selecciona las mesas y sillas que NO se podrán vender para este evento.
                </span>
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-layout"
                  onClick={() => setShowLayoutModal(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                  </svg>
                  Configurar layout (mesas y sillas)
                </button>
                {form.disabledTables && form.disabledTables.length > 0 ? (
                  <small style={{ color: "#e9d5ff", fontWeight: 600 }}>
                    Mesas deshabilitadas:{" "}
                    <strong>{form.disabledTables.join(", ")}</strong>
                  </small>
                ) : (
                  <small style={{ color: "#c4b5fd" }}>
                    No hay mesas deshabilitadas.
                  </small>
                )}
                
                {form.disabledSeats && form.disabledSeats.length > 0 ? (
                  <small style={{ color: "#e9d5ff", fontWeight: 600 }}>
                    Sillas deshabilitadas: <strong>{form.disabledSeats.length}</strong>
                  </small>
                ) : (
                  <small style={{ color: "#c4b5fd" }}>No hay sillas deshabilitadas.</small>
                )}
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
                            className={`btn-status ${
                              ev.status === "published"
                                ? "btn-status--published"
                                : "btn-status--draft"
                            }`}
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
                            className="btn-edit"
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
              disabledSeats={form.disabledSeats ?? []}
              onChange={(next) => {
                setField("disabledTables", next.disabledTables);
                setField("disabledSeats", next.disabledSeats);
              }}
              onClose={() => setShowLayoutModal(false)}
            />
          )}
        </>
      ) : (
        <SalesTab events={events} />
      )}
      </div>
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
                    <div style={{ color: "#c4b5fd" }}>{r.userPhone}</div>
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

type LayoutEditorModalProps = {
  disabledTables: string[];
  disabledSeats: string[];
  onChange: (next: { disabledTables: string[]; disabledSeats: string[] }) => void;
  onClose: () => void;
};

function LayoutEditorModal({
  disabledTables,
  disabledSeats,
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



const tables: LayoutTable[] = useMemo(() => {
  // Geometría real del salón
  const geom: TableGeom[] = buildTables();

  // 🔴 Filtramos las mesas que mandaste al infinito (ORO-24, ORO-25, etc.)
  const filtered = geom.filter(
    (t) =>
      Math.abs(t.cx) < 5000 &&
      Math.abs(t.cy) < 5000 &&
      !["ORO-24", "ORO-25", "VIP-15"].includes(t.id) // si quieres ocultarlas también del admin
  );

  return filtered.map((t) => {
    const [zone, numStr] = t.id.split("-");
    const num = parseInt(numStr || "1", 10) || 1;
    const letter = numToLetter(num); // A, B, C...

    return {
      id: t.id,
      zoneId: t.zoneId,
      cx: t.cx,
      cy: t.cy,
      label: `${zone}-${letter}`, // VIP-A, ORO-K, etc.
    };
  });
}, []);

// Escala solo para el modal de admin
const TABLE_SCALE = 1.3; // prueba 1.3, 1.4 o lo que te guste
const TABLE_W_MODAL = TABLE_W * TABLE_SCALE;
const TABLE_H_MODAL = TABLE_H * TABLE_SCALE;
const TABLE_R_MODAL = TABLE_R * TABLE_SCALE;


  const layoutViewBox = useMemo(() => {
    if (!tables.length) return "0 0 3000 1600";

    const padX = 80;
    const padY = 80;

    const xs = tables.map((t) => t.cx);
    const ys = tables.map((t) => t.cy);

    const minX = Math.min(...xs) - TABLE_W / 2 - padX;
    const maxX = Math.max(...xs) + TABLE_W / 2 + padX;
    const minY = Math.min(...ys) - TABLE_H / 2 - padY;
    const maxY = Math.max(...ys) + TABLE_H / 2 + padY;

    let width = maxX - minX;
    let height = maxY - minY;

    if (width <= 0) width = 1;
    if (height <= 0) height = 1;

    return `${minX} ${minY} ${width} ${height}`;

  }, [tables]);


  const [mode, setMode] = useState<"tables" | "seats">("tables");

const [localDisabledTables, setLocalDisabledTables] = useState<Set<string>>(
  () => new Set(disabledTables)
);

const [localDisabledSeats, setLocalDisabledSeats] = useState<Set<string>>(
  () => new Set(disabledSeats)
);

const toggleTable = (id: string) => {
  setLocalDisabledTables((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const toggleSeat = (tableId: string, seatId: string) => {
  const key = `${tableId}:${seatId}`;
  setLocalDisabledSeats((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
};

  const handleSave = () => {
    onChange({
      disabledTables: Array.from(localDisabledTables),
      disabledSeats: Array.from(localDisabledSeats),
    });
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
          background: "#120c24",
          color: "#e5e7eb",
          borderRadius: 14,
          border: "1px solid rgba(168, 85, 247, 0.3)",
          maxWidth: "1000px",
          width: "100%",
          maxHeight: "80vh",
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
            {mode === "tables"
              ? "Haz clic en una mesa para habilitarla o deshabilitarla."
              : "Haz clic en una silla para habilitarla o deshabilitarla."}
          </span>

          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              onClick={() => setMode("tables")}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid",
                borderColor: mode === "tables" ? "transparent" : "#334155",
                background: mode === "tables" ? "linear-gradient(135deg, #7c3aed, #9333ea)" : "#1e293b",
                color: mode === "tables" ? "#ffffff" : "#cbd5e1",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Mesas
            </button>

            <button
              type="button"
              onClick={() => setMode("seats")}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid",
                borderColor: mode === "seats" ? "transparent" : "#334155",
                background: mode === "seats" ? "linear-gradient(135deg, #7c3aed, #9333ea)" : "#1e293b",
                color: mode === "seats" ? "#ffffff" : "#cbd5e1",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Sillas
            </button>
          </div>


          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              borderRadius: 999,
              padding: "5px 12px",
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Cerrar ✕
          </button>
        </header>

        <div style={{ padding: 12, flex: 1, overflow: "auto" }}>
          <svg
            viewBox={layoutViewBox}
            style={{ width: "100%", maxHeight: 600 }}
          >
            {/* Stage */}
            <g transform="translate(-80, 750)">
            <rect x="-100" y="-190" width="250" height="830" fill="#ffffffff" rx="10" />
            <text x="-150" y="10" fill="#000000ff" fontSize="90" textAnchor="middle" transform="rotate(-90 44,0)">
              ESCENARIO
            </text>
          </g>
            {/* Mesas */}
            {tables.map((t) => {
              const isTableDisabled = localDisabledTables.has(t.id);
              const strokeBase = t.zoneId === "VIP" ? "#7c3aed" : "#d4af37";

              return (
                <g key={t.id}>
                  {/* Mesa (siempre visible) */}
                  <g
                    onClick={mode === "tables" ? () => toggleTable(t.id) : undefined}
                    style={{ cursor: mode === "tables" ? "pointer" : "default" }}
                  >
                    <rect
                      x={t.cx - TABLE_W_MODAL / 2}
                      y={t.cy - TABLE_H_MODAL / 2}
                      width={TABLE_W_MODAL}
                      height={TABLE_H_MODAL}
                      rx={TABLE_R_MODAL}
                      ry={TABLE_R_MODAL}
                      fill={isTableDisabled ? "#1a102f" : "#24183d"}
                      stroke={isTableDisabled ? "#ef4444" : strokeBase}
                      strokeWidth={isTableDisabled ? 6 : 3}
                      opacity={isTableDisabled ? 0.75 : 1}
                    />
                    <text
                      x={t.cx}
                      y={t.cy + 10}
                      fontSize={30 * TABLE_SCALE}
                      textAnchor="middle"
                      fill={isTableDisabled ? "#fca5a5" : "#f3effd"}
                      style={{ pointerEvents: "none", fontWeight: 900, letterSpacing: 0.6 }}
                    >
                      {t.label}
                    </text>
                  </g>

                  {/* Sillas (solo en modo seats) */}
                  {mode === "seats" &&
                    (() => {
                      // Necesitamos la mesa completa con seats reales
                      const full = buildTables().find((x) => x.id === t.id);
                      if (!full) return null;

                      return full.seats.map((s) => {
                        const key = `${t.id}:${s.id}`;
                        const isSeatDisabled = localDisabledSeats.has(key);

                        // si la mesa está deshabilitada, bloqueamos click de sillas (recomendado)
                        const canClick = !isTableDisabled;

                        return (
                          <g
                            key={key}
                            onClick={
                              canClick ? () => toggleSeat(t.id, s.id) : undefined
                            }
                            style={{
                              cursor: canClick ? "pointer" : "not-allowed",
                              opacity: canClick ? 1 : 0.5,
                            }}
                          >
                            <circle cx={s.x} cy={s.y} r={22} fill="transparent" />
                            <circle
                              cx={s.x}
                              cy={s.y}
                              r={14}
                              fill={isSeatDisabled ? "#ef4444" : "#9ca3af"}
                              stroke="#111827"
                              strokeWidth={2}
                            />
                            <text
                              x={s.x}
                              y={s.y + 4}
                              textAnchor="middle"
                              fontSize={10}
                              fill="#0b1220"
                              style={{ pointerEvents: "none", fontWeight: 700 }}
                            >
                              {s.label}
                            </text>
                          </g>
                        );
                      });
                    })()}
                </g>
              );
            })}
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
            Mesas: {localDisabledTables.size ? localDisabledTables.size : 0} |{" "}
            Sillas: {localDisabledSeats.size ? localDisabledSeats.size : 0}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (mode === "tables") setLocalDisabledTables(new Set());
                else setLocalDisabledSeats(new Set());
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#cbd5e1",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Limpiar
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                color: "#ffffff",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.4)",
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
