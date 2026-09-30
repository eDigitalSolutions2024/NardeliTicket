// src/pages/Cart.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { getEvent } from "../api/events";
import type { EventItem } from "../types/Event";
import "../CSS/Cart.css";

type CartItem = {
  zoneId: string;      // "VIP" | "ORO" | "GENERAL"
  tableId: string;     // p.ej. "ORO-04" | "GENERAL"
  seatIds: string[];   // ["S183", ...] (vacío en admisión general)
  unitPrice: number;   // precio por asiento/boleto
  quantity?: number;   // admisión general: cantidad de boletos
  ticketType?: string; // admisión general
};

// Cantidad de boletos de un item: por asientos (seated) o por cantidad (general)
function itemQty(it: CartItem): number {
  if (Array.isArray(it.seatIds) && it.seatIds.length) return it.seatIds.length;
  return Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 0;
}

type CartTotals = {
  subtotal: number;
  fees: number;
  total: number;
  seatCount: number;
};

type BuyerInfo = {
  name: string;
  phone?: string;
  email?: string;
};

type CartPayload = {
  eventId: string;
  items: CartItem[];
  totals: CartTotals;
  sessionDate?: string;
  sessionId?: string;
  buyer?: BuyerInfo;
};

type PaymentMethod = "card" | "cash";

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
  const [sessionId] = useState<string | undefined>(initialPayload?.sessionId);

  // Datos del evento (para la vista previa)
  const [event, setEvent] = useState<EventItem | null>(null);
  useEffect(() => {
    let alive = true;
    if (!eventId) return;
    (async () => {
      try {
        const ev = await getEvent(eventId);
        if (alive) setEvent(ev);
      } catch {
        /* si falla, seguimos sin preview */
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventId]);

  // Método de pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

  // Datos del comprador (los usamos sobre todo para pago en efectivo)
  const [buyerName, setBuyerName] = useState<string>(initialPayload?.buyer?.name ?? "");
  const [buyerPhone, setBuyerPhone] = useState<string>(initialPayload?.buyer?.phone ?? "");
  const [buyerEmail, setBuyerEmail] = useState<string>(initialPayload?.buyer?.email ?? "");

  // Modal de efectivo
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashGiven, setCashGiven] = useState<string>("");

  // feePct aproximado a partir del payload inicial
  const feePct = useMemo(() => {
    if (!initialPayload || initialPayload.totals.subtotal <= 0) return 0;
    return Math.round((initialPayload.totals.fees / initialPayload.totals.subtotal) * 100);
  }, [initialPayload]);

  // 2) Recalcular totales cuando cambian los items
  const totals = useMemo<CartTotals>(() => {
    const seatCount = items.reduce((acc, it) => acc + itemQty(it), 0);
    const subtotal = items.reduce((acc, it) => acc + itemQty(it) * it.unitPrice, 0);
    const fees = feePct > 0 ? (subtotal * feePct) / 100 : 0;
    return { seatCount, subtotal, fees, total: subtotal + fees };
  }, [items, feePct]);

  const totalToPay = totals.total || 0;
  const numericCashGiven = parseFloat(cashGiven || "0");
  const cashChange = numericCashGiven - totalToPay;
  const isCashEnough = numericCashGiven >= totalToPay;
  const isBuyerValid = buyerName.trim().length > 0;

  // 3) Persistir cambios en sessionStorage (para sobrevivir recargas)
  useEffect(() => {
    const payload: CartPayload = {
      eventId,
      items,
      totals,
      sessionDate,
      sessionId,
      buyer: {
        name: buyerName,
        phone: buyerPhone,
        email: buyerEmail,
      },
    };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  }, [eventId, items, totals, sessionDate, buyerName, buyerPhone, buyerEmail]);

  // 4) Helpers de edición
  function removeSeat(tableId: string, seatId: string) {
    setItems((prev) =>
      prev
        .map((it) =>
          it.tableId === tableId
            ? { ...it, seatIds: it.seatIds.filter((s) => s !== seatId) }
            : it
        )
        .filter((it) => it.seatIds.length > 0)
    );
  }

  function removeTable(tableId: string) {
    setItems((prev) => prev.filter((it) => it.tableId !== tableId));
  }

  // Admisión general: cambiar cantidad de boletos de un item
  function updateQty(idx: number, nextQty: number) {
    setItems((prev) =>
      prev
        .map((it, i) => (i === idx ? { ...it, quantity: Math.max(0, nextQty) } : it))
        .filter((it) => itemQty(it) > 0)
    );
  }

  function clearAll() {
    setItems([]);
  }

  // 5) Acción principal: Ir a pagar (preflight -> create session)
async function handleCheckout(
  method: PaymentMethod,
  cashData?: { amountGiven: number; change: number },
  cashCustomer?: BuyerInfo
) {
  if (!eventId || items.length === 0) return;

  try {
    const bodyBase: any = {
      eventId,
      items,
      totals,
      sessionDate,
      sessionId,
      paymentMethod: method,
    };

    // Mandar buyer también para otros flujos si quieres
    if (cashCustomer) {
      bodyBase.cashCustomer = cashCustomer;
    }

    if (method === "cash" && cashData) {
      bodyBase.cashPayment = {
        amountGiven: cashData.amountGiven,
        change: cashData.change,
      };
    }

    console.log("checkout payload", {
      eventId,
      sessionDate,
      sessionId,
      paymentMethod: method,
      items,
      totals,
    });
    // 1) Preflight: confirma totales en el servidor (centavos)
    const { data: pre } = await api.post("/checkout/preflight", bodyBase);

    // 2) Crear sesión de checkout / orden usando los totales confirmados
    const { data } = await api.post("/checkout", {
      ...bodyBase,
      pricing: pre?.pricing,
      holdGroupId: pre?.hold?.holdGroupId,
    });

    // --------------------------
    //       TARJETA / STRIPE
    // --------------------------
    if (method === "card") {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data?.orderId) {
        navigate(`/order/${data.orderId}`);
        return;
      }
      alert("Checkout creado, pero no se recibió URL ni ID de orden.");
      return;
    }

    // --------------------------
    //       PAGO EN EFECTIVO
    // --------------------------
    if (method === "cash") {
      if (data?.orderId) {
        const orderId = data.orderId as string;

        // SIEMPRE usamos la ruta interna del front
        const targetUrl = `/checkout/success?orderId=${orderId}&pm=cash`;

        navigate(targetUrl, {
          state: {
            orderId,
            paymentMethod: "cash",
            phone: buyerPhone || undefined,
            buyerName: buyerName || undefined,
          },
        });

        // Opcional: limpiar carrito
        // sessionStorage.removeItem(PENDING_KEY);
        // setItems([]);
        return;
      }
      alert("Se registró el pago en efectivo, pero no se recibió ID de orden.");
      return;
    }
  } catch (err: any) {
    // 👇 aquí va el catch corregido (lo pongo completo abajo)
    if (err?.response?.status === 401) {
      navigate("/auth?tab=login", { state: { redirectTo: "/cart" }, replace: true });
      return;
    }
    if (err?.response?.status === 403 && method === "cash") {
      alert("El pago en efectivo solo está permitido para cuentas internas (taquilla/admin).");
      return;
    }
    if (err?.response?.status === 409) {
      const msg =
        err?.response?.data?.message ||
        "Algunos boletos ya no están disponibles. Vuelve a intentar.";
      alert(msg);
      return;
    }
    console.error(err);
    alert("No se pudo iniciar el checkout.");
  }
}


  // Botón principal
  function handlePayClick() {
    if (items.length === 0) return;
    if (paymentMethod === "card") {
      handleCheckout("card");
    } else {
      // abrir modal de efectivo
      setCashGiven("");
      setShowCashModal(true);
    }
  }

  function handleConfirmCash() {
    if (!isCashEnough || !isBuyerValid) return;

    const amountGiven = Number(numericCashGiven.toFixed(2));
    const change = Number(cashChange.toFixed(2));

    const customer: BuyerInfo = {
      name: buyerName.trim(),
      phone: buyerPhone.trim() || undefined,
      email: buyerEmail.trim() || undefined,
    };

    setShowCashModal(false);
    handleCheckout("cash", { amountGiven, change }, customer);
  }

  // 6) Si no hay payload/ítems, UI de vacío
  if (!initialPayload && items.length === 0) {
    return (
      <div className="cart">
        <div className="cart-backdrop" aria-hidden />
        <h1 className="cart__title">Carrito</h1>
        <p className="cart__empty">Tu carrito está vacío. Vuelve a elegir tus boletos.</p>
        <Link to="/events" className="cart__empty-link">Ir a eventos →</Link>
      </div>
    );
  }

  const isCash = paymentMethod === "cash";

  return (
    <div className="cart">
      <div className="cart-backdrop" aria-hidden />
      <h1 className="cart__title">Carrito</h1>

      {items.length === 0 ? (
        <>
          <p className="cart__empty">Tu carrito está vacío.</p>
          <button className="cart-btn" onClick={() => navigate(`/event/${eventId}/seleccion`)}>
            Volver a seleccionar asientos
          </button>
        </>
      ) : (
        <div className="cart-grid">
          <div className="cart-main">
            {/* Vista previa del evento */}
            {event && (
              <div className="cart-event">
                <div className="cart-event__media">
                  <img className="cart-event__blur" src={event.imageUrl} alt="" aria-hidden />
                  <img className="cart-event__img" src={event.imageUrl} alt={event.title} />
                </div>
                <div className="cart-event__info">
                  {event.category && <span className="cart-event__cat">✦ {event.category}</span>}
                  <h2 className="cart-event__title">{event.title}</h2>
                  <p className="cart-event__meta">📍 {event.venue} — {event.city}</p>
                  {sessionDate && (
                    <p className="cart-event__date">
                      🗓️{" "}
                      {new Date(sessionDate).toLocaleString("es-MX", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

          {/* Lista de items */}
          <div className="cart-items">
            {items.map((it, idx) => {
              const isGeneral = !(Array.isArray(it.seatIds) && it.seatIds.length);
              const qty = itemQty(it);

              return (
                <div key={it.tableId + ":" + idx} className="cart-item">
                  <div>
                    {isGeneral ? (
                      <>
                        <div className="cart-item__title">
                          Boleto general <span className="cart-item__sub">(admisión general)</span>
                        </div>
                        <div className="cart-qty">
                          <span className="cart-qty__label">Cantidad:</span>
                          <button onClick={() => updateQty(idx, qty - 1)}>−</button>
                          <span className="cart-qty__num">{qty}</span>
                          <button onClick={() => updateQty(idx, qty + 1)}>+</button>
                        </div>
                        <button className="cart-remove" onClick={() => removeTable(it.tableId)}>
                          Quitar
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="cart-item__title">
                          {it.tableId} <span className="cart-item__sub">({it.zoneId})</span>
                        </div>
                        <div className="cart-seats">
                          {it.seatIds.map((sid) => (
                            <span
                              key={sid}
                              title="Quitar asiento"
                              className="cart-seat"
                              onClick={() => removeSeat(it.tableId, sid)}
                            >
                              {sid}
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" />
                              </svg>
                            </span>
                          ))}
                        </div>
                        <button className="cart-remove" onClick={() => removeTable(it.tableId)}>
                          Quitar mesa completa
                        </button>
                      </>
                    )}
                  </div>

                  <div className="cart-item__amount">
                    <div className="cart-price">{money(it.unitPrice * qty, currency)}</div>
                    <div className="cart-price__unit">{money(it.unitPrice, currency)} c/u</div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>{/* /cart-main */}

          <aside className="cart-side">
          {/* Totales */}
          <div className="cart-totals">
            <div className="lbl">Subtotal</div>
            <div className="val">{money(totals.subtotal, currency)}</div>
            <div className="lbl">Tarifa de servicio {feePct ? `(${feePct}%)` : ""}</div>
            <div className="val">{money(totals.fees, currency)}</div>
            <hr />
            <div className="total-lbl">Total</div>
            <div className="total-val">{money(totals.total, currency)}</div>
          </div>

          {/* Selector de método de pago */}
          <div className="cart-pay">
            <div className="cart-pay__title">Método de pago</div>
            <label>
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
              />
              <span>Tarjeta / pago en línea</span>
            </label>
            <label>
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={paymentMethod === "cash"}
                onChange={() => setPaymentMethod("cash")}
              />
              <span>Pago en efectivo en taquilla</span>
            </label>

            {paymentMethod === "cash" && (
              <p className="cart-pay__note">
                El pago en efectivo es solo para taquilla/admin dentro del salón. Registra los datos
                del cliente, el monto recibido y el cambio antes de confirmar.
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="cart-actions">
            <button className="cart-btn" onClick={() => navigate(`/event/${eventId}/seleccion`)}>
              Seguir seleccionando
            </button>

            <button
              className="cart-btn cart-btn--danger"
              onClick={clearAll}
            >
              Vaciar carrito
            </button>

            <button
              className={`cart-btn cart-btn--pay ${isCash ? "is-cash" : ""}`}
              onClick={handlePayClick}
              disabled={items.length === 0}
            >
              {paymentMethod === "card" ? "Pagar ahora" : "Registrar pago en efectivo"}
            </button>
          </div>
          </aside>{/* /cart-side */}
        </div>
      )}

      {/* MODAL PAGO EN EFECTIVO */}
      {showCashModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#ffffff",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 20px 40px rgba(15,23,42,0.3)",
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              Pago en efectivo
            </h2>

            {/* Datos del cliente */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Nombre del cliente <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Nombre completo"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                }}
              />
              {!isBuyerValid && (
                <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>
                  El nombre del cliente es obligatorio.
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="10 dígitos o con lada"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  Correo (opcional)
                </label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="cliente@correo.com"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                  }}
                />
              </div>
            </div>

            <hr style={{ margin: "14px 0" }} />

            {/* Totales / efectivo */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  fontSize: 14,
                }}
              >
                <span>Total a pagar</span>
                <strong>{money(totalToPay, currency)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                Cantidad que el cliente está dando
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                }}
              >
                <span>Cambio</span>
                <strong>
                  {cashGiven
                    ? cashChange >= 0
                      ? money(cashChange, currency)
                      : `-${money(Math.abs(cashChange), currency)}`
                    : money(0, currency)}
                </strong>
              </div>
              {!isCashEnough && cashGiven && (
                <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>
                  La cantidad recibida es menor al total.
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 14,
              }}
            >
              <button
                onClick={() => {
                  setShowCashModal(false);
                  setCashGiven("");
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  fontSize: 14,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCash}
                disabled={!isCashEnough || !isBuyerValid}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    !isCashEnough || !isBuyerValid ? "#9ca3af" : "#22c55e",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor:
                    !isCashEnough || !isBuyerValid ? "not-allowed" : "pointer",
                }}
              >
                Confirmar pago en efectivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
