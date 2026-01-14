// src/pages/SeatSelectionPage.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getEvent, fetchBlockedSeats } from "../api/events"; // 👈 precios y nombre desde Mongo
import { buildTables, TABLE_W,TABLE_H, TABLE_R, numToLetter, type TableGeom, } from "../layout/salonLayout";

const SALON_IMG = "/salon_blueprint.jpg"; // ruta en /public

/* ----------------------------- Types ----------------------------- */
export type SeatStatus = "available" | "reserved" | "held";
export type Seat = { id: string; label: string; status: SeatStatus };
export type TableNode = { id: string; name: string; seats: Seat[]; capacity: number };
export type Zone = {
  id: "VIP" | "ORO";
  name: string;
  color: string;
  price: number;
  selectionMode: "seat" | "table";
  tables: TableNode[];
};
export type EventLayout = {
  eventId: string;
  eventName: string;
  currency: string;
  zones: Zone[];
  maxSeatsPerOrder?: number;
  feePct?: number;
  disabledTables?: string[];
  disabledSeats?: string [];
};

function ModalImage({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0b1220",
          border: "1px solid #1f2937",
          borderRadius: 12,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            border: "1px solid #374151",
            background: "#111827",
            color: "#e5e7eb",
            borderRadius: 8,
            padding: "4px 8px",
            cursor: "pointer",
          }}
        >
          Cerrar ✕
        </button>
        <img
          src={src}
          alt={alt || "Plano del salón"}
          style={{ display: "block", maxWidth: "95vw", maxHeight: "90vh" }}
        />
      </div>
    </div>
  );
}

/* --------------------- Helpers --------------------- */
function pesos(n: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);
}

/* Carga layout desde API y mapea a EventLayout (precios y nombre reales) */
async function fetchAvailability(eventId: string, eventName?: string): Promise<EventLayout> {
  const ev = await getEvent(eventId);

  // 👇 soporta disabledTables y el posible typo disbledTables
  const rawDisabled = (ev as any).disabledTables ?? (ev as any).disbledTables ?? [];
  const rawDisabledSeats = (ev as any).disabledSeats ?? (ev as any).disabledSeats ?? [];


    console.log("Evento desde backend", ev);
    console.log("Mesas deshabilitadas desde backend", rawDisabled);
    console.log("Sillas deshabilitadas:", rawDisabledSeats);

    return {
      eventId: ev.id,
      eventName: eventName || ev.title || "Evento",
      currency: "MXN",
      maxSeatsPerOrder: 12,
      feePct: 5,
      zones: [
        {
          id: "VIP",
          name: "VIP",
          color: "#1e62ff",
          price: Number(ev.pricing?.vip ?? 0),
          selectionMode: "seat",
          tables: [],
        },
        {
          id: "ORO",
          name: "Zona Oro",
          color: "#d4af37",
          price: Number(ev.pricing?.oro ?? 0),
          selectionMode: "seat",
          tables: [],
        },
      ],
      disabledTables: rawDisabled,   // 👈 aquí
      disabledSeats: rawDisabledSeats,
    };
  }

  


/* ----------------------------- Small UI ----------------------------- */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: "#111827",
        color: "#e5e7eb",
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}
function SeatDot({
  state,
  onClick,
}: {
  state: "available" | "reserved" | "held" | "selected";
  onClick?: () => void;
}) {
  const map: Record<string, string> = {
    available: "#9ca3af",
    reserved: "#ef4444",
    held: "#f59e0b",
    selected: "#22c55e",
  };
  const interactive = state === "available" || state === "selected";
  return (
    <button
      onClick={interactive ? onClick : undefined}
      title={state}
      style={{
        width: 18,
        height: 18,
        borderRadius: "999px",
        background: map[state],
        border: "2px solid #111827",
        cursor: interactive ? "pointer" : "not-allowed",
      }}
    />
  );
}


function SeatMapSVG({
  selected,
  onlyAvailable,
  onToggle,
  onReady,
  blockedKeys,
  disabledTables,
  disabledSeatKeys,
  isMobile,
}: {
  selected: Record<string, string[]>;
  onlyAvailable: boolean;
  onToggle: (tableId: string, seatId: string) => void;
  onReady: (tables: TableGeom[]) => void;
  onPreview: () => void;
  blockedKeys?: Set<string>;
  disabledTables?: Set<string>;
  disabledSeatKeys?: Set<string>;
  isMobile?: boolean;
}) {
  const tables = useMemo<TableGeom[]>(() => buildTables(), []);

  const baseView = isMobile
    ? {
        scale: 1.30,                // un poco más pequeño para que quepa completo
        offset: { x: 450, y: 0 } // mueve todo un poco hacia la derecha y arriba
      }
    : {
        scale: 1,
        offset: { x: 450, y: 0 }
      };

  // Pan/Zoom
  const [scale, setScale] = useState(baseView.scale);
  const [offset, setOffset] = useState(baseView.offset);
  const drag = useRef<null | { x: number; y: number }>(null);

  useEffect(() => onReady(tables), [tables, onReady]);

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setScale((s) => Math.max(0.4, Math.min(3, s - e.deltaY * 0.0015)));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMouseUp = () => (drag.current = null);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };

  const colorBy = (state: SeatStatus | "selected") =>
    state === "selected"
      ? "#22c55e"
      : state === "available"
      ? "#9ca3af"
      : state === "held"
      ? "#f59e0b"
      : "#ef4444";
    return (
      <div
        style={{
          background: "#0b1220",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="300 -30 2600 2750"
          style={{
            width: "100%",
            height: isMobile ? 520 : 1000, // 👉 más compacto en cel
            cursor: drag.current ? "grabbing" : "grab",
          }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
            {/* Stage */}
            <g transform="translate(-80, 750)">
              <rect
                x="-100"
                y="-190"
                width="250"
                height="830"
                fill="#ffffffff"
                rx="10"
              />
              <text
                x="-150"
                y="10"
                fill="#000000ff"
                fontSize="90"
                textAnchor="middle"
                transform="rotate(-90 44,0)"
              >
                ESCENARIO
              </text>
            </g>

            {tables.map((t) => {
              const isTableDisabled = disabledTables?.has(t.id) ?? false;
              if (isTableDisabled) return null;

              return (
                  <g key={t.id} opacity={isTableDisabled ? 0.8 : 1}>
                    {/* Mesa */}
                    <g style={{ pointerEvents: "none" }}>
                      {/* pinta como disabled si aplica */}
                      <rect
                        x={t.cx - TABLE_W / 2}
                        y={t.cy - TABLE_H / 2}
                        width={TABLE_W}
                        height={TABLE_H}
                        rx={TABLE_R}
                        ry={TABLE_R}
                        fill={isTableDisabled ? "#111827" : "#e9eef7"}
                        stroke={
                          isTableDisabled
                            ? "#ef4444"
                            : t.zoneId === "VIP"
                            ? "#1e62ff"
                            : "#d4af37"
                        }
                        strokeWidth={isTableDisabled ? 7 : 5}
                      />
                      <text
                        x={t.cx}
                        y={t.cy + 8}
                        fontSize={30}
                        textAnchor="middle"
                        fill={isTableDisabled ? "#fca5a5" : "#334155"}
                        style={{ fontWeight: 900, letterSpacing: 0.6 }}
                      >
                        {(() => {
                          const [zone, numStr] = t.id.split("-");
                          const num = parseInt(numStr, 10);
                          return !isNaN(num) && num >= 1 ? `${zone}-${numToLetter(num)}` : t.id;
                        })()}
                      </text>
                    </g>

                    {/* Sillas */}
                    {t.seats.map((s) => {
                      const sel = (selected[t.id] || []).includes(s.id);
                      const key = `${t.id}:${s.id}`;
                      const isBlocked = blockedKeys?.has(key) ?? false;
                      const isAdminSeatDisabled = disabledSeatKeys?.has(key) ?? false;
                      if (isAdminSeatDisabled) return null;

                      // 👇 si la mesa está deshabilitada, tratamos todas sus sillas como bloqueadas
                      const trulyBlocked = isTableDisabled || isBlocked;

                      const visualState = trulyBlocked
                        ? "reserved"
                        : s.status === "available"
                        ? sel
                          ? "selected"
                          : "available"
                        : s.status;

                      const fill = colorBy(visualState as any);

                      const shouldHide = onlyAvailable && !sel && visualState === "held";
                      if (shouldHide) return null;

                      return (
                        <g
                          key={s.id}
                          onClick={() => {
                            if (trulyBlocked && !sel) return; // 👈 no permitir click si está bloqueado (o mesa disabled)
                            onToggle(t.id, s.id);
                          }}
                          style={{
                            cursor: trulyBlocked && !sel ? "not-allowed" : "pointer",
                            opacity: trulyBlocked && !sel ? 0.9 : 1,
                          }}
                        >
                          <circle cx={s.x} cy={s.y} r={26} fill="transparent" />
                          <circle cx={s.x} cy={s.y} r={18} fill={fill} stroke="#111827" strokeWidth={2} />
                          <text
                            x={s.x}
                            y={s.y + 5}
                            textAnchor="middle"
                            fontSize={12}
                            fill="#0b1220"
                            style={{ pointerEvents: "none", fontWeight: 700 }}
                          >
                            {s.label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
            })}

          </g>
        </svg>
      </div>
    );
}




/* -------------------------- Main Page Component -------------------------- */
export default function SeatSelectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionDate, sessionId, eventName } = (location.state ?? {}) as {
    sessionDate?: string;
    sessionId?: string;
    eventName?: string;
  };
  const [showPreview, setShowPreview] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!sessionDate && id) navigate(`/events/${id}`, { replace: true });
  }, [sessionDate, id, navigate]);

  const eventId = id ?? "unknown";

  const [layout, setLayout] = useState<EventLayout | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [blockedFromSales, setBlockedFromSales] = useState<Set<string>>(new Set());

  // 1) bloqueos por ventas (SeatHold)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!sessionId) return; // 👈 si no hay sessionId no podemos consultar
        const blocked = await fetchBlockedSeats(eventId, sessionId);
        if (mounted) setBlockedFromSales(new Set(blocked));
      } catch (e) {
        console.error("No se puedieron cargar asientos bloqueados");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [eventId, sessionId]);

  // 2) layout + disabledTables desde el evento
  useEffect(() => {
    fetchAvailability(eventId, eventName).then(setLayout);
  }, [eventId, eventName]);

  // Persistencia
  useEffect(() => {
    const raw = sessionStorage.getItem(`NT_SEL_${eventId}`);
    if (raw) setSelected(JSON.parse(raw));
  }, [eventId]);
  useEffect(() => {
    sessionStorage.setItem(`NT_SEL_${eventId}`, JSON.stringify(selected));
  }, [eventId, selected]);

  // Inyectar mesas al layout
  //type TableGeomLocal = TableGeom; // solo para tipado local
  const injectTablesIntoLayout = useCallback((tables: TableGeom[]) => {
    setLayout((prev) => {
      if (!prev) return prev;
      const clone: EventLayout = JSON.parse(JSON.stringify(prev));
      const vip = tables.filter((t) => t.zoneId === "VIP");
      const oro = tables.filter((t) => t.zoneId === "ORO");
      const vipZone = clone.zones.find((z) => z.id === "VIP")!;
      const oroZone = clone.zones.find((z) => z.id === "ORO")!;
      vipZone.tables = vip.map((t) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        seats: t.seats.map((s) => ({ id: s.id, label: s.label, status: s.status })),
      }));
      oroZone.tables = oro.map((t) => ({
        id: t.id,
        name: t.name,
        capacity: t.capacity,
        seats: t.seats.map((s) => ({ id: s.id, label: s.label, status: s.status })),
      }));
      return clone;
    });
  }, []);

  // Índices auxiliares
  const priceByTable: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    layout?.zones.forEach((z) => z.tables.forEach((t) => (map[t.id] = z.price)));
    return map;
  }, [layout]);
  const zoneByTable: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    layout?.zones.forEach((z) => z.tables.forEach((t) => (map[t.id] = z.id)));
    return map;
  }, [layout]);

  // índice para obtener el label (A1, B3, etc.) a partir de tableId + seatId
  const seatLabelByKey: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    layout?.zones.forEach((z) =>
      z.tables.forEach((t) =>
        t.seats.forEach((s) => {
          map[`${t.id}:${s.id}`] = s.label;
        })
      )
    );
    return map;
  }, [layout]);

  // 3) Combinar bloqueos de ventas + mesas deshabilitadas por el admin
  const blockedKeys = useMemo(() => {
    const merged = new Set<string>(blockedFromSales);

    if (layout?.disabledSeats?.length) {
      layout.disabledSeats.forEach((key) => {
        merged.add(key);
      });
    }
    
    return merged;
  }, [blockedFromSales, layout?.disabledSeats]);


  const selectionItems = useMemo(() => {
    if (!layout)
      return [] as Array<{
        zoneId: string;
        tableId: string;
        seatIds: string[];
        seatLabels: string[]; // 👈
        unitPrice: number;
      }>;

    const items: Array<{
      zoneId: string;
      tableId: string;
      seatIds: string[];
      seatLabels: string[];
      unitPrice: number;
    }> = [];

    Object.entries(selected).forEach(([tableId, seatIds]) => {
      if (seatIds.length === 0) return;

      const seatLabels = seatIds.map(
        (seatId) => seatLabelByKey[`${tableId}:${seatId}`] ?? seatId
      );

      items.push({
        zoneId: zoneByTable[tableId],
        tableId,
        seatIds,
        seatLabels,
        unitPrice: priceByTable[tableId],
      });
    });

    return items;
  }, [layout, priceByTable, zoneByTable, selected, seatLabelByKey]);

  const totals = useMemo(() => {
    if (!layout) return { subtotal: 0, fees: 0, total: 0, seatCount: 0 };
    const seatCount = selectionItems.reduce((acc, it) => acc + it.seatIds.length, 0);
    const subtotal = selectionItems.reduce((acc, it) => acc + it.seatIds.length * it.unitPrice, 0);
    const fees = layout.feePct ? (subtotal * layout.feePct) / 100 : 0;
    return { subtotal, fees, total: subtotal + fees, seatCount };
  }, [layout, selectionItems]);

   const disabledTablesSet = useMemo(() => {
    if (!layout?.disabledTables) return new Set<string>();
    return new Set(layout.disabledTables);
  }, [layout?.disabledTables]);

  const disabledSeatKeysSet = useMemo(() => {
    return new Set<string>(layout?.disabledSeats ?? []);
  },[layout?.disabledSeats]);

  useEffect(() => {
    console.log("Admin disabledTables:", layout?.disabledTables);
    console.log("Admin disabledSeats:", layout?.disabledSeats?.slice(0, 10), "… total:", layout?.disabledSeats?.length ?? 0);
  }, [layout?.disabledTables, layout?.disabledSeats]);

  useEffect(() => {
  if (!layout) return;

  setSelected((prev) => {
    let changed = false;
    const next: Record<string, string[]> = {};

    for (const [tableId, seatIds] of Object.entries(prev)) {
      // Si la mesa fue deshabilitada por admin -> elimina toda selección de esa mesa
      if (disabledTablesSet.has(tableId)) {
        changed = true;
        continue;
      }

      // Filtra sillas que ahora estén deshabilitadas o bloqueadas
      const filtered = seatIds.filter((seatId) => {
        const key = `${tableId}:${seatId}`;
        return !disabledSeatKeysSet.has(key) && !blockedKeys.has(key);
      });

      if (filtered.length !== seatIds.length) changed = true;
      if (filtered.length) next[tableId] = filtered;
    }

    return changed ? next : prev;
  });
}, [layout, disabledTablesSet, disabledSeatKeysSet, blockedKeys]);


  const maxReached =
    layout?.maxSeatsPerOrder && totals.seatCount > (layout.maxSeatsPerOrder ?? Infinity);

  function handleToggleFromMap(tableId: string, seatId: string) {
    setSelected((prev) => {
      const arr = prev[tableId] ? [...prev[tableId]] : [];
      const i = arr.indexOf(seatId);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(seatId);
      return { ...prev, [tableId]: arr };
    });
  }
  function clearSelection() {
    setSelected({});
  }

  if (!layout) return <div style={{ padding: 24 }}>Cargando disposición del evento…</div>;

if (!layout)
  return <div style={{ padding: 24 }}>Cargando disposición del evento…</div>;

return (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.4fr) 360px",
      gap: isMobile ? 12 : 16,
      padding: isMobile ? 8 : 16,
    }}
  >
    {/* LEFT: MAPA */}
    <div>
      <header
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{layout.eventName}</h1>
        <Pill>{layout.eventId}</Pill>
        {sessionDate && (
          <Pill>
            {new Date(sessionDate).toLocaleString("es-MX", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Pill>
        )}
        <div
          style={{
            marginLeft: isMobile ? 0 : "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginTop: isMobile ? 8 : 0,
          }}
        >
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            Mostrar solo disponibles
          </label>
          <button
            onClick={clearSelection}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            Limpiar
          </button>
        </div>
      </header>

      <SeatMapSVG
        selected={selected}
        onlyAvailable={onlyAvailable}
        onToggle={handleToggleFromMap}
        onReady={injectTablesIntoLayout}
        onPreview={() => setShowPreview(true)}
        blockedKeys={blockedKeys}
        disabledTables={disabledTablesSet}
        disabledSeatKeys={disabledSeatKeysSet}
        isMobile={isMobile}
      />
    </div>

    {/* RIGHT: CARRITO */}
    <aside
      style={{
        position: isMobile ? "static" : "sticky",
        top: isMobile ? undefined : 16,
        alignSelf: "start",
        marginTop: isMobile ? 12 : 0,
      }}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
          background: "#0b1220",
          color: "#e5e7eb",
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid #1f2937" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Tu selección
          </h3>
          <small>{totals.seatCount} asiento(s)</small>
        </div>

        <div style={{ maxHeight: 280, overflow: "auto" }}>
          {selectionItems.length === 0 ? (
            <div style={{ padding: 16, color: "#9ca3af" }}>
              Aún no has seleccionado asientos.
            </div>
          ) : (
            selectionItems.map((it) => (
              <div
                key={`${it.tableId}`}
                style={{
                  padding: 12,
                  borderBottom: "1px solid #1f2937",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{it.tableId}</div>
                  <div style={{ fontSize: 12 }}>
                    Asientos: {it.seatLabels.join(", ")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>
                    {pesos(
                      it.unitPrice * it.seatIds.length,
                      layout.currency
                    )}
                  </div>
                  <small style={{ color: "#9ca3af" }}>
                    {pesos(it.unitPrice, layout.currency)} c/u
                  </small>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #1f2937" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 6,
            }}
          >
            <span>Subtotal</span>
            <strong>{pesos(totals.subtotal, layout.currency)}</strong>
            <span>
              Tarifa de servicio{" "}
              {layout.feePct ? `(${layout.feePct}%)` : ""}
            </span>
            <strong>{pesos(totals.fees, layout.currency)}</strong>
            <span>Total</span>
            <strong>{pesos(totals.total, layout.currency)}</strong>
          </div>
          {maxReached && (
            <div style={{ marginTop: 8, color: "#ef4444", fontSize: 12 }}>
              Excediste el máximo de {layout.maxSeatsPerOrder} asientos por
              orden. Quita algunos para continuar.
            </div>
          )}
          <button
            onClick={() => {
              if (
                layout.maxSeatsPerOrder &&
                totals.seatCount > (layout.maxSeatsPerOrder ?? Infinity)
              )
                return;

              const rawToken = localStorage.getItem("token");
              const hasToken =
                !!rawToken &&
                rawToken !== "undefined" &&
                rawToken !== "null" &&
                rawToken.trim() !== "";

              const payload = {
                eventId: layout.eventId,
                items: selectionItems,
                totals,
                sessionDate,
                sessionId,
              };

              if (!hasToken) {
                sessionStorage.setItem(
                  "NT_PENDING_CHECKOUT",
                  JSON.stringify(payload)
                );
                navigate("/auth?tab=login", {
                  state: { redirectTo: "/cart" },
                  replace: true,
                });
                return;
              }

              navigate("/cart", { state: payload });
            }}
            disabled={selectionItems.length === 0 || !!maxReached}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              background:
                selectionItems.length === 0 || !!maxReached
                  ? "#374151"
                  : "#22c55e",
              color: "white",
              border: "none",
              fontWeight: 700,
              cursor:
                selectionItems.length === 0 || !!maxReached
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Continuar al pago
          </button>
        </div>
      </div>

      {/* Leyenda */}
      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "#0b1220",
          color: "#e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <SeatDot state="available" /> <span>Disponible</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <SeatDot state="selected" /> <span>Seleccionado</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <SeatDot state="held" /> <span>En proceso</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SeatDot state="reserved" /> <span>Reservado</span>
        </div>
      </div>
      {showPreview && (
        <ModalImage src={SALON_IMG} onClose={() => setShowPreview(false)} />
      )}
    </aside>
  </div>
);

}
