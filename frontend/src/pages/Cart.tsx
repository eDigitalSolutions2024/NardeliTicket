// src/pages/Cart.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client"; // <-- usa tu instancia con interceptors. Ajusta la ruta si tu archivo se llama distinto.

type CartItem = {
  zoneId: string;           // "VIP" | "ORO"
  tableId: string;          // p.ej. "ORO-04"
  seatIds: string[];        // ["S183", ...]
  unitPrice: number;        // precio por asiento para esa mesa/zona
};

type CartTotals = {
  subtotal: number;
  fees: number;
  total: number;
  seatCount: number;
};

type CartPayload = {
  eventId: string;
  items: CartItem[];
  totals: CartTotals;
  sessionDate?: string;
};

const PENDING_KEY = "NT_PENDING_CHECKOUT";

function money(n: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);
}

export default function CartPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // 1) Cargar payload desde state o sessionStorage
  const initialPayload: CartPayload | null = useMemo(() => {
    if (location.state) return location.state as CartPayload;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? (JSON.parse(raw) as CartPayload) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const [items, setItems] = useState<CartItem[]>(initialPayload?.items ?? []);
  const [currency] = useState<"MXN">("MXN");
  const [eventId] = useState<string>(initialPayload?.eventId ?? "");
  const [sessionDate] = useState<string | undefined>(initialPayload?.sessionDate);

  // feePct aproximado a partir del payload inicial (si no lo tienes fijo aquí)
  const feePct = useMemo(() => {
    if (!initialPayload || initialPayload.totals.subtotal <= 0) return 0;
    return Math.round((initialPayload.totals.fees / initialPayload.totals.subtotal) * 100);
  }, [initialPayload]);

  // 2) Recalcular totales cuando cambian los items
  const totals = useMemo<CartTotals>(() => {
    const seatCount = items.reduce((acc, it) => acc + it.seatIds.length, 0);
    const subtotal = items.reduce((acc, it) => acc + it.seatIds.length * it.unitPrice, 0);
    const fees = feePct > 0 ? (subtotal * feePct) / 100 : 0;
    return { seatCount, subtotal, fees, total: subtotal + fees };
  }, [items, feePct]);

  // 3) Persistir cambios en sessionStorage (para sobrevivir recargas)
  useEffect(() => {
    const payload: CartPayload = { eventId, items, totals, sessionDate };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  }, [eventId, items, totals, sessionDate]);

  // 4) Helpers de edición
  function removeSeat(tableId: string, seatId: string) {
    setItems((prev) =>
      prev
        .map((it) =>
          it.tableId === tableId
            ? { ...it, seatIds: it.seatIds.filter((s) => s !== seatId) }
            : it
        )
        .filter((it) => it.seatIds.length > 0) // si se queda sin asientos, quita el ítem
    );
  }
  function removeTable(tableId: string) {
    setItems((prev) => prev.filter((it) => it.tableId !== tableId));
  }
  function clearAll() {
    setItems([]);
  }

  // 5) Acción principal: Ir a pagar (preflight -> create session)
async function handleCheckout() {
  if (!eventId || items.length === 0) return;

  try {
    const bodyBase: CartPayload = { eventId, items, totals, sessionDate };

    // 1) Preflight: confirma totales en el servidor (centavos)
    const { data: pre } = await api.post("/api/checkout/preflight", bodyBase);

    // (opcional) podrías comparar y mostrar pre.pricing al usuario

    // 2) Crear sesión de checkout usando los totales confirmados
    const { data } = await api.post("/api/checkout", {
      ...bodyBase,
      pricing: pre?.pricing, // <--- totales confirmados en centavos
      holdGroupId: pre?.hold?.holdGroupId,
    });

    if (data?.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else if (data?.orderId) {
      navigate(`/order/${data.orderId}`);
    } else {
      alert("Checkout creado, pero no se recibió URL ni ID de orden.");
    }
  } catch (err: any) {
    if (err?.response?.status === 401) {
      navigate("/auth?tab=login", { state: { redirectTo: "/cart" }, replace: true });
      return;
    }
    if (err?.response?.status === 409) {
      alert("Algunos asientos ya no están disponibles. Vuelve a seleccionar.");
      navigate(`/event/${eventId}/seleccion`);
      return;
    }
    console.error(err);
    alert("No se pudo iniciar el checkout.");
  }
}


  // 6) Si no hay payload/ítems, UI de vacío
  if (!initialPayload && items.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 42, marginBottom: 8 }}>Carrito</h1>
        <p>No llegó ningún payload. Vuelve a seleccionar asientos y dale “Continuar al pago”.</p>
        <Link to="/events">Ir a eventos</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 42, marginBottom: 4 }}>Carrito</h1>
      {sessionDate && (
        <div style={{ marginBottom: 16, color: "#4b5563" }}>
          Sesión:{" "}
          {new Date(sessionDate).toLocaleString("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      )}

      {items.length === 0 ? (
        <>
          <p>Tu carrito está vacío.</p>
          <button
            onClick={() => navigate(`/event/${eventId}/seleccion`)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb" }}
          >
            Volver a seleccionar asientos
          </button>
        </>
      ) : (
        <>
          {/* Lista de items */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
              marginBottom: 16,
            }}
          >
            {items.map((it) => (
              <div
                key={it.tableId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  padding: 14,
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {it.tableId} <span style={{ color: "#6b7280" }}>({it.zoneId})</span>
                  </div>
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {it.seatIds.map((sid) => (
                      <span
                        key={sid}
                        title="Quitar asiento"
                        onClick={() => removeSeat(it.tableId, sid)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                          cursor: "pointer",
                          userSelect: "none",
                          fontSize: 13,
                        }}
                      >
                        {sid}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="#9ca3af" strokeWidth="2" />
                        </svg>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => removeTable(it.tableId)}
                    style={{
                      marginTop: 10,
                      padding: "4px 10px",
                      borderRadius: 8,
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      color: "#b91c1c",
                      fontSize: 12,
                    }}
                  >
                    Quitar mesa completa
                  </button>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>
                    {money(it.unitPrice * it.seatIds.length, currency)}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>
                    {money(it.unitPrice, currency)} c/u
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              maxWidth: 520,
              marginBottom: 16,
            }}
          >
            <div>Subtotal</div>
            <div style={{ fontWeight: 700 }}>{money(totals.subtotal, currency)}</div>
            <div>Tarifa de servicio {feePct ? `(${feePct}%)` : ""}</div>
            <div style={{ fontWeight: 700 }}>{money(totals.fees, currency)}</div>
            <div>Total</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{money(totals.total, currency)}</div>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate(`/event/${eventId}/seleccion`)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              Seguir seleccionando
            </button>

            <button
              onClick={clearAll}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #fee2e2",
                background: "#fff1f2",
                color: "#991b1b",
              }}
            >
              Vaciar carrito
            </button>

            <button
              onClick={handleCheckout}
              disabled={items.length === 0}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: items.length === 0 ? "#9ca3af" : "#22c55e",
                color: "white",
                fontWeight: 700,
                marginLeft: "auto",
                cursor: items.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Pagar ahora
            </button>
          </div>
        </>
      )}
    </div>
  );
}
