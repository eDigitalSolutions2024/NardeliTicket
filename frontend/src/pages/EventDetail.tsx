import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getEvent } from "../api/events";
import type { EventItem, EventSession } from "../types/Event";
import "../CSS/EventDetail.css";


function sortAsc(a: string, b: string) {
  return new Date(a).getTime() - new Date(b).getTime();
}
function isFuture(iso: string) {
  return new Date(iso).getTime() >= Date.now();
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!id) return;
        const ev = await getEvent(id);
        setEvent(ev);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const futureSessions: EventSession[] = useMemo(() => {
    if (!event) return [];
    return (event.sessions ?? [])
      .filter((s) => isFuture(s.date))
      .sort((a, b) => sortAsc(a.date, b.date));
  }, [event]);

  if (loading) return <main className="u-container"><p>Cargando evento…</p></main>;
  if (!event) return <main className="u-container"><p>No se encontró el evento.</p></main>;

  return (
    <main className="u-container" style={{ maxWidth: 1000 }}>
      {/* Encabezado */}
      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "1.2fr 1fr", alignItems: "start" }}>
        <div style={{ borderRadius: 12, overflow: "hidden" }}>
          <img
            src={event.imageUrl}
            alt={event.title}
            style={{ width: "100%", height: 420, objectFit: "cover" }}
          />
        </div>

        <div>
          <h1 style={{ margin: "0 0 6px 0" }}>{event.title}</h1>
          <p style={{ margin: "0 0 14px 0", color: "#475569" }}>
            <strong>{event.venue}</strong> — {event.city}
          </p>

          {/* Fechas */}
          <div>
            <h3 style={{ margin: "18px 0 8px 0" }}>Fechas disponibles</h3>

            {futureSessions.length === 0 ? (
              <p>No hay fechas próximas.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {futureSessions.map((s) => (
                  <label
                    key={s.id ?? s.date}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: "1px solid #e6e8ef",
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="session"
                      value={s.date}
                      checked={selected === s.date}
                      onChange={() => setSelected(s.date)}
                    />
                    <span>{new Date(s.date).toLocaleString("es-MX")}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button
              className="btn-primary"
              disabled={!selected}
              onClick={() => {
                  if (!selected || !event) return;
                  // Ir a la página de selección con el id en la URL
                  // y pasar la fecha/ sesión seleccionada por state
                  navigate(`/event/${event.id}/seleccion`, {
                    state: { sessionDate: selected,
                      eventName: event.title,
                     },
                  });
                }}
              style={{ height: 44, padding: "0 16px", fontWeight: 700 }}
            >
              Adquirir boletos
            </button>

            <button
              className="btn-secondary"
              onClick={() => navigate(-1)}
              style={{ height: 44, padding: "0 14px" }}
            >
              Regresar
            </button>
          </div>
        </div>
      </section>

      {/* Info extra sencilla (opcional) */}
      <section style={{ marginTop: 24 }}>
        {event.category && (
          <p style={{ color: "#64748b" }}>
            Categoría: <strong>{event.category}</strong>
          </p>
        )}
      </section>
    </main>
  );
}
