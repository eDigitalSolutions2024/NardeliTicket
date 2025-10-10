import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getEvent } from "../api/events"; // 👈 precios y nombre desde Mongo

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
};

/* --------------------- Helpers --------------------- */
function pesos(n: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n);
}

/* Carga layout desde API y mapea a EventLayout.
   Mantiene feePct/maxSeatsPerOrder por defecto para no cambiar el UI. */
async function fetchAvailability(eventId: string, eventName?: string): Promise<EventLayout> {
  const ev = await getEvent(eventId);
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
        price: Number(ev.pricing?.vip ?? 0), // 👈 precio real VIP
        selectionMode: "seat",
        tables: [],
      },
      {
        id: "ORO",
        name: "Zona Oro",
        color: "#d4af37",
        price: Number(ev.pricing?.oro ?? 0), // 👈 precio real ORO
        selectionMode: "seat",
        tables: [],
      },
    ],
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

/* -------------------------- Embedded SVG Map -------------------------- */
// Tamaños mesa
const TABLE_W = 170;
const TABLE_H = 86;
const TABLE_R = 16;
// separación entre mesas
const STEP_X = 260;
const STEP_Y = 190;
// Offsets independientes por zona
const VIP_OFFSETS = { topY: -70, bottomY: 70, leftX: -105, rightX: 110 };
const ORO_OFFSETS = { topY: -70, bottomY: 70, leftX: -105, rightX: 110 };
// Patrón de 10 asientos
const makePattern = ({
  topY,
  bottomY,
  leftX,
  rightX,
}: {
  topY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
}): [number, number][] => [
  [-52, topY],
  [-26, topY],
  [0, topY],
  [26, topY],
  [-52, bottomY],
  [-26, bottomY],
  [0, bottomY],
  [26, bottomY],
  [leftX, 0],
  [rightX, 0],
];

const SEAT_PATTERN_VIP = makePattern(VIP_OFFSETS);
const SEAT_PATTERN_ORO = makePattern(ORO_OFFSETS);

type SeatNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  status: SeatStatus;
  zoneId: "VIP" | "ORO";
  tableId: string;
};
type TableGeom = {
  id: string;
  name: string;
  zoneId: "VIP" | "ORO";
  seats: SeatNode[];
  capacity: number;
  cx: number;
  cy: number;
};

function SeatMapSVG({
  selected,
  onlyAvailable,
  onToggle,
  onReady,
}: {
  selected: Record<string, string[]>;
  onlyAvailable: boolean;
  onToggle: (tableId: string, seatId: string) => void;
  onReady: (tables: TableGeom[]) => void;
}) {
  const tables = useMemo<TableGeom[]>(() => {
    const out: TableGeom[] = [];
    let seatGlobal = 0;

    // ZONA VIP (izquierda) 3 x 5
    const vipOrigin = { x: 260, y: 300 };
    let tVip = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        tVip++;
        const id = `VIP-${String(tVip).padStart(2, "0")}`;
        const cx = vipOrigin.x + c * STEP_X;
        const cy = vipOrigin.y + r * STEP_Y;
        const seats: SeatNode[] = SEAT_PATTERN_VIP.map(([dx, dy], i) => {
          seatGlobal++;
          return {
            id: `S${seatGlobal}`,
            label: String(i + 1),
            x: cx + dx,
            y: cy + dy,
            status: "available",
            zoneId: "VIP",
            tableId: id,
          };
        });
        out.push({ id, name: `Mesa VIP ${tVip}`, zoneId: "VIP", seats, capacity: seats.length, cx, cy });
      }
    }

    // ZONA ORO (derecha) 5 x 5
    const oroOrigin = { x: 1160, y: 300 };
    let tOro = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        tOro++;
        const id = `ORO-${String(tOro).padStart(2, "0")}`;
        const cx = oroOrigin.x + c * STEP_X;
        const cy = oroOrigin.y + r * STEP_Y;
        const seats: SeatNode[] = SEAT_PATTERN_ORO.map(([dx, dy], i) => {
          seatGlobal++;
          return {
            id: `S${seatGlobal}`,
            label: String(i + 1),
            x: cx + dx,
            y: cy + dy,
            status: "available",
            zoneId: "ORO",
            tableId: id,
          };
        });
        out.push({ id, name: `Mesa Oro ${tOro}`, zoneId: "ORO", seats, capacity: seats.length, cx, cy });
      }
    }

    return out;
  }, []);

  // Pan/Zoom
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<null | { x: number; y: number }>(null);

  useEffect(() => onReady(tables), [tables, onReady]);

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    setScale((s) => Math.max(0.5, Math.min(3, s - e.deltaY * 0.0015)));
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
    state === "selected" ? "#22c55e" : state === "available" ? "#9ca3af" : state === "held" ? "#f59e0b" : "#ef4444";

  const renderTableRect = (t: TableGeom) => (
    <g key={`${t.id}-rect`}>
      <rect
        x={t.cx - TABLE_W / 2}
        y={t.cy - TABLE_H / 2}
        width={TABLE_W}
        height={TABLE_H}
        rx={TABLE_R}
        ry={TABLE_R}
        fill="#e9eef7"
        stroke="#8aa0c7"
        strokeWidth={2}
      />
      <text
        x={t.cx}
        y={t.cy + 7}
        fontSize={16}
        textAnchor="middle"
        fill="#334155"
        style={{ pointerEvents: "none", fontWeight: 800, letterSpacing: 0.3 }}
      >
        {t.id}
      </text>
    </g>
  );

  return (
    <div style={{ background: "#0b1220", borderRadius: 12, overflow: "hidden" }}>
      <svg
        viewBox="0 0 3000 1600"
        style={{ width: "100%", height: 760, cursor: drag.current ? "grabbing" : "grab" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
      >
        <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
          {/* Stage */}
          <g transform="translate(40, 520)">
            <rect x="0" y="-190" width="88" height="380" fill="#111" rx="10" />
            <text x="44" y="0" fill="#e5e7eb" fontSize="20" textAnchor="middle" transform="rotate(-90 44,0)">
              STAGE
            </text>
          </g>

          {/* Marcos de zona */}
          {/* VIP */}
          <rect x="110" y="120" width="820" height="1200" fill="none" stroke="#1e62ff" strokeWidth={14} rx={20} />
          <g transform="translate(140, 205)">
            <text x="16" y="-105" fill="#e5e7eb" fontSize={34} fontWeight={900}>
              ZONA VIP — 15 mesas × 10 asientos
            </text>
          </g>

          {/* ORO */}
          <rect x="990" y="120" width="1440" height="1200" fill="none" stroke="#d4af37" strokeWidth={14} rx={20} />
          <g transform="translate(1320, 205)">
            <text x="16" y="-105" fill="#e5e7eb" fontSize={34} fontWeight={900}>
              ZONA ORO — 25 mesas × 10 asientos
            </text>
          </g>

          {/* Mesas + asientos */}
          {tables.map((t) => (
            <g key={t.id}>
              {renderTableRect(t)}
              {t.seats.map((s) => {
                const sel = (selected[t.id] || []).includes(s.id);
                const state = s.status === "available" ? (sel ? "selected" : "available") : s.status;
                const fill = colorBy(state as any);
                if (onlyAvailable && s.status !== "available" && !sel) return null;
                return (
                  <circle
                    key={s.id}
                    cx={s.x}
                    cy={s.y}
                    r={11}
                    fill={fill}
                    stroke="#111827"
                    strokeWidth={2}
                    onClick={() => (s.status === "available" || sel) && onToggle(t.id, s.id)}
                  />
                );
              })}
            </g>
          ))}

          {/* Leyenda */}
          <g transform="translate(140, 1380)">
            <rect x="0" y="-34" width="600" height="52" fill="#0f1629" rx="12" />
            <line x1="20" y1="-10" x2="80" y2="-10" stroke="#1e62ff" strokeWidth={10} />
            <text x="92" y="-3" fill="#e5e7eb" fontSize={18}>
              Marco Azul = VIP
            </text>
            <line x1="300" y1="-10" x2="360" y2="-10" stroke="#d4af37" strokeWidth={10} />
            <text x="372" y="-3" fill="#e5e7eb" fontSize={18}>
              Marco Dorado = Zona ORO
            </text>
          </g>
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
  const { sessionDate, eventName } = (location.state ?? {}) as { sessionDate?: string; eventName?: string };

  // Si alguien entra sin fecha seleccionada, regrésalo al detalle del evento
  useEffect(() => {
    if (!sessionDate && id) navigate(`/events/${id}`, { replace: true });
  }, [sessionDate, id, navigate]);

  const eventId = id ?? "unknown";

  const [layout, setLayout] = useState<EventLayout | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

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
  type TableGeomLocal = TableGeom; // solo para tipado local
  const injectTablesIntoLayout = (tables: TableGeomLocal[]) => {
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
  };

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

  // Selección → items + totales
  const selectionItems = useMemo(() => {
    if (!layout) return [] as Array<{ zoneId: string; tableId: string; seatIds: string[]; unitPrice: number }>;
    const items: Array<{ zoneId: string; tableId: string; seatIds: string[]; unitPrice: number }> = [];
    Object.entries(selected).forEach(([tableId, seatIds]) => {
      if (seatIds.length === 0) return;
      items.push({ zoneId: zoneByTable[tableId], tableId, seatIds, unitPrice: priceByTable[tableId] });
    });
    return items;
  }, [layout, priceByTable, zoneByTable, selected]);

  const totals = useMemo(() => {
    if (!layout) return { subtotal: 0, fees: 0, total: 0, seatCount: 0 };
    const seatCount = selectionItems.reduce((acc, it) => acc + it.seatIds.length, 0);
    const subtotal = selectionItems.reduce((acc, it) => acc + it.seatIds.length * it.unitPrice, 0);
    const fees = layout.feePct ? (subtotal * layout.feePct) / 100 : 0;
    return { subtotal, fees, total: subtotal + fees, seatCount };
  }, [layout, selectionItems]);

  const maxReached = layout?.maxSeatsPerOrder && totals.seatCount > (layout.maxSeatsPerOrder ?? Infinity);

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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, padding: 16 }}>
      {/* LEFT: MAPA */}
      <div>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{layout.eventName}</h1>
          <Pill>{layout.eventId}</Pill>
          {sessionDate && (
            <Pill>{new Date(sessionDate).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</Pill>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
              Mostrar solo disponibles
            </label>
            <button
              onClick={clearSelection}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white" }}
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
        />
      </div>

      {/* RIGHT: CARRITO */}
      <aside style={{ position: "sticky", top: 16, alignSelf: "start" }}>
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
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tu selección</h3>
            <small>{totals.seatCount} asiento(s)</small>
          </div>

          <div style={{ maxHeight: 280, overflow: "auto" }}>
            {selectionItems.length === 0 ? (
              <div style={{ padding: 16, color: "#9ca3af" }}>Aún no has seleccionado asientos.</div>
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
                    <div style={{ fontSize: 12 }}>Asientos: {it.seatIds.join(", ")}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>{pesos(it.unitPrice * it.seatIds.length, layout.currency)}</div>
                    <small style={{ color: "#9ca3af" }}>{pesos(it.unitPrice, layout.currency)} c/u</small>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: 16, borderTop: "1px solid #1f2937" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
              <span>Subtotal</span>
              <strong>{pesos(totals.subtotal, layout.currency)}</strong>
              <span>Tarifa de servicio {layout.feePct ? `(${layout.feePct}%)` : ""}</span>
              <strong>{pesos(totals.fees, layout.currency)}</strong>
              <span>Total</span>
              <strong>{pesos(totals.total, layout.currency)}</strong>
            </div>
            {maxReached && (
              <div style={{ marginTop: 8, color: "#ef4444", fontSize: 12 }}>
                Excediste el máximo de {layout.maxSeatsPerOrder} asientos por orden. Quita algunos para continuar.
              </div>
            )}
            <button
              onClick={() => {
                if (layout.maxSeatsPerOrder && totals.seatCount > layout.maxSeatsPerOrder) return;
                // Ir al carrito con el payload completo + la fecha seleccionada
                navigate("/cart", {
                  state: {
                    eventId: layout.eventId,
                    items: selectionItems,
                    totals,
                    sessionDate,
                  },
                });
              }}
              disabled={selectionItems.length === 0 || !!maxReached}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: selectionItems.length === 0 || !!maxReached ? "#374151" : "#22c55e",
                color: "white",
                border: "none",
                fontWeight: 700,
                cursor: selectionItems.length === 0 || !!maxReached ? "not-allowed" : "pointer",
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <SeatDot state="available" /> <span>Disponible</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <SeatDot state="selected" /> <span>Seleccionado</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <SeatDot state="held" /> <span>En proceso</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SeatDot state="reserved" /> <span>Reservado</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
