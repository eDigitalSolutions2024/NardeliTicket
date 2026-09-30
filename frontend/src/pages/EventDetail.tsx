import  { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getEvent } from "../api/events";
import type { EventItem, EventSession } from "../types/Event";
import { useAuth } from "../auth/AuthProviders";
import "../CSS/EventDetail.css";

const PENDING_KEY = "NT_PENDING_CHECKOUT";
const SERVICE_FEE_PCT = 5;

function money(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}


function sortAsc(a: string, b: string) {
  return new Date(a).getTime() - new Date(b).getTime();
}
function isFuture(iso: string) {
  return new Date(iso).getTime() >= Date.now();
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ sessionId: string; sessionDate: string } | null>(null);
  const [qty, setQty] = useState(1);

  const isGeneral = event?.admissionType === "general";
  const gaPrice = event?.generalAdmission?.price ?? 0;
  const gaCapacity = event?.generalAdmission?.capacity ?? null;

  function goToCheckoutGeneral() {
    if (!event || !selected) return;
    const quantity = Math.max(1, qty);
    const subtotal = gaPrice * quantity;
    const fees = Math.round(subtotal * SERVICE_FEE_PCT) / 100;
    const payload = {
      eventId: event.id,
      items: [
        {
          zoneId: "GENERAL",
          tableId: "GENERAL",
          ticketType: "general",
          quantity,
          seatIds: [] as string[],
          unitPrice: gaPrice,
        },
      ],
      totals: { subtotal, fees, total: subtotal + fees, seatCount: quantity },
      sessionDate: selected.sessionDate,
      sessionId: selected.sessionId,
    };

    if (!user) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      navigate("/auth?tab=login", { state: { redirectTo: "/cart" }, replace: true });
      return;
    }
    navigate("/cart", { state: payload });
  }

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

  if (loading) return <main className="ed-status"><div className="ed-backdrop" aria-hidden /><p>Cargando evento…</p></main>;
  if (!event) return <main className="ed-status"><div className="ed-backdrop" aria-hidden /><p>No se encontró el evento.</p></main>;

  return (
    <main className="ed">
      <div className="ed-backdrop" aria-hidden />

      <div className="ed-grid">
        {/* Media */}
        <div className="ed-media">
          <img className="ed-media__blur" src={event.imageUrl} alt="" aria-hidden />
          <img className="ed-media__img" src={event.imageUrl} alt={event.title} />
          {event.category && <span className="ed-cat">✦ {event.category}</span>}
        </div>

        {/* Panel */}
        <aside className="ed-panel">
          <h1 className="ed-title">{event.title}</h1>
          <p className="ed-venue">
            <span aria-hidden>📍</span>
            <span>{event.venue} — {event.city}</span>
          </p>

          {/* Fechas */}
          <div className="ed-section-title">Fechas disponibles</div>
          {futureSessions.length === 0 ? (
            <p className="ed-empty">No hay fechas próximas.</p>
          ) : (
            <div className="ed-sessions">
              {futureSessions.map((s: any) => {
                const sid = String(s._id ?? s.id ?? s.date);
                const active = selected?.sessionId === sid;
                return (
                  <label key={sid} className={`ed-session ${active ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="session"
                      value={s.date}
                      checked={active}
                      onChange={() => setSelected({ sessionId: sid, sessionDate: s.date })}
                    />
                    <span>
                      {new Date(s.date).toLocaleString("es-MX", {
                        weekday: "short",
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Admisión general: precio + cantidad */}
          {isGeneral && (
            <div className="ed-buybox">
              <div className="ed-row">
                <span className="ed-buy-label">Boleto general</span>
                <span className="ed-price">{money(gaPrice)}</span>
              </div>

              <div className="ed-row">
                <span className="ed-buy-label">Cantidad</span>
                <div className="ed-qty">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <input
                    type="number"
                    min={1}
                    max={gaCapacity ?? undefined}
                    value={qty}
                    onChange={(e) => {
                      const n = Math.max(1, Number(e.target.value) || 1);
                      setQty(gaCapacity ? Math.min(n, gaCapacity) : n);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setQty((q) => (gaCapacity ? Math.min(gaCapacity, q + 1) : q + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="ed-row">
                <span className="ed-sub-label">Subtotal</span>
                <span className="ed-sub-value">{money(gaPrice * qty)}</span>
              </div>
              {gaCapacity !== null && (
                <p className="ed-cap-note">Cupo del evento: {gaCapacity} boletos.</p>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="ed-actions">
            {isGeneral ? (
              <button className="btn-primary" disabled={!selected || gaPrice <= 0} onClick={goToCheckoutGeneral}>
                Continuar al pago
              </button>
            ) : (
              <button
                className="btn-primary"
                disabled={!selected}
                onClick={() => {
                  if (!selected || !event) return;
                  navigate(`/event/${event.id}/seleccion`, {
                    state: {
                      sessionDate: selected.sessionDate,
                      sessionId: selected.sessionId,
                      eventName: event.title,
                    },
                  });
                }}
              >
                Adquirir boletos
              </button>
            )}

            <button className="btn-secondary" onClick={() => navigate(-1)}>Regresar</button>
          </div>
        </aside>
      </div>
    </main>
  );
}
