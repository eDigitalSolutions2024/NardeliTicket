// src/pages/Cart.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";

type CartItem = {
  zoneId: string;      // "VIP" | "ORO"
  tableId: string;     // p.ej. "ORO-04"
  seatIds: string[];   // ["S183", ...]
  unitPrice: number;   // precio por asiento para esa mesa/zona
};

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
    const seatCount = items.reduce((acc, it) => acc + it.seatIds.length, 0);
    const subtotal = items.reduce((acc, it) => acc + it.seatIds.length * it.unitPrice, 0);
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
      alert("Algunos asientos ya no están disponibles. Vuelve a seleccionar.");
      navigate(`/event/${eventId}/seleccion`);
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
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 42, marginBottom: 8 }}>Carrito</h1>
        <p>No llegó ningún payload. Vuelve a seleccionar asientos y dale “Continuar al pago”.</p>
        <Link to="/events">Ir a eventos</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, position: "relative" }}>
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

          {/* Selector de método de pago */}
          <div
            style={{
              maxWidth: 520,
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Método de pago</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
              />
              <span>Tarjeta / pago en línea</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              <p style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>
                El pago en efectivo es solo para taquilla/admin dentro del salón. Registra los datos
                del cliente, el monto recibido y el cambio antes de confirmar.
              </p>
            )}
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
              onClick={handlePayClick}
              disabled={items.length === 0}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background:
                  items.length === 0
                    ? "#9ca3af"
                    : paymentMethod === "card"
                    ? "#22c55e"
                    : "#f59e0b",
                color: "white",
                fontWeight: 700,
                marginLeft: "auto",
                cursor: items.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {paymentMethod === "card" ? "Pagar ahora" : "Registrar pago en efectivo"}
            </button>
          </div>
        </>
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
