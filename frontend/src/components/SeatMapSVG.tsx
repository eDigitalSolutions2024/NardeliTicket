import React, { useMemo, useRef, useState } from "react";

type SeatNode = {
  id: string;
  label: string;
  x: number; // px in SVG coords
  y: number;
  status: "available" | "reserved" | "held";
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

export type MapPayload = {
  tables: TableGeom[];
};

export default function SeatMapSVG({
  onToggle,
  selected,
  onlyAvailable,
  blockedKeys,
}: {
  onToggle: (tableId: string, seatId: string) => void;
  selected: Record<string, string[]>;
  onlyAvailable: boolean;
  blockedKeys?: Set<string>;
}) {
  // ------- Geometría con 25 (ORO) + 15 (VIP), 10 asientos por mesa -------
  const data = useMemo<MapPayload>(() => {
    const tables: TableGeom[] = [];
    let s = 0;

    // patrón de 10 asientos alrededor de la mesa
    // (4 arriba, 4 abajo, 2 laterales)
    const seats10: [number, number][] = [
      // top row
      [-45, -55], [-22, -55], [0, -55], [22, -55],
      // bottom row
      [-45, 55], [-22, 55], [0, 55], [22, 55],
      // sides
      [-85, 0], [85, 0],
    ];

    // -------- ZONA ORO (izquierda/centro): 5x5 = 25 mesas ----------
    // marco pensado para viewBox 1400x800
    const oroOrigin = { x: 120, y: 150 };
    const oroStep = { x: 170, y: 140 };
    let tOro = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        tOro++;
        const tableId = `ORO-${String(tOro).padStart(2, "0")}`;
        const cx = oroOrigin.x + col * oroStep.x;
        const cy = oroOrigin.y + row * oroStep.y;
        const seats: SeatNode[] = seats10.map(([dx, dy], i) => {
          s++;
          return {
            id: `S${s}`,
            label: String(i + 1),
            x: cx + dx,
            y: cy + dy,
            status: "available",
            zoneId: "ORO",
            tableId,
          };
        });
        tables.push({
          id: tableId,
          name: `Mesa Oro ${tOro}`,
          zoneId: "ORO",
          seats,
          capacity: seats.length,
          cx,
          cy,
        });
      }
    }

    // -------- ZONA VIP (derecha): 3x5 = 15 mesas ----------
    const vipOrigin = { x: 1020, y: 150 };
    const vipStep = { x: 170, y: 140 };
    let tVip = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        tVip++;
        const tableId = `VIP-${String(tVip).padStart(2, "0")}`;
        const cx = vipOrigin.x + col * vipStep.x;
        const cy = vipOrigin.y + row * vipStep.y;
        const seats: SeatNode[] = seats10.map(([dx, dy], i) => {
          s++;
          return {
            id: `S${s}`,
            label: String(i + 1),
            x: cx + dx,
            y: cy + dy,
            status: "available",
            zoneId: "VIP",
            tableId,
          };
        });
        tables.push({
          id: tableId,
          name: `Mesa VIP ${tVip}`,
          zoneId: "VIP",
          seats,
          capacity: seats.length,
          cx,
          cy,
        });
      }
    }

    return { tables };
  }, []);

  // ---------------- Pan & Zoom ----------------
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef<null | { x: number; y: number }>(null);

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const next = Math.max(0.5, Math.min(3, scale - e.deltaY * 0.0015));
    setScale(next);
  };
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMouseUp = () => {
    dragging.current = null;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
  };

  const colorBy = (state: string) =>
    state === "available"
    ? "#9ca3af"
    : state === "held"
    ? "#f59e0b"
    : state === "selected"
    ? "#22c55e"
    : "#ef4444";

  // helpers para mesa visual
  const renderTable = (t: TableGeom) => {
    // mesa centrada en cx,cy (120×60)
    const w = 120, h = 60, r = 10;
    return (
      <g key={t.id}>
        <rect
          x={t.cx - w / 2}
          y={t.cy - h / 2}
          width={w}
          height={h}
          rx={r}
          ry={r}
          fill="#e9eef7"
          stroke="#8aa0c7"
          strokeWidth={2}
        />
        {/* etiqueta pequeña de mesa */}
        <text
          x={t.cx}
          y={t.cy + 5}
          fontSize={12}
          textAnchor="middle"
          fill="#334155"
          style={{ pointerEvents: "none", fontWeight: 600 }}
        >
          {t.id}
        </text>
      </g>
    );
  };

  return (
    <div style={{ background: "#0b1220", borderRadius: 12, overflow: "hidden" }}>
      <svg
        viewBox="0 0 1400 800"
        style={{ width: "100%", height: 620, cursor: dragging.current ? "grabbing" : "grab" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
      >
        <defs>
          <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>

        <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
          {/* Escenario a la izquierda (decorativo) */}
          <g transform="translate(30, 280)" filter="url(#soft)">
            <rect x="0" y="-120" width="70" height="240" fill="#111" rx="8" />
            <text
              x="35"
              y="0"
              fill="#e5e7eb"
              fontSize="18"
              textAnchor="middle"
              transform="rotate(-90 35,0)"
            >
              STAGE
            </text>
          </g>

          {/* Marcos de ZONA */}
          {/* ORO */}
          <rect
            x="60"
            y="80"
            width="900"
            height="600" 
            fill="none"
            stroke="#d4af37"
            strokeWidth={8}
            rx={14}
          />
          <text x="80" y="120" fill="#e5e7eb" fontSize="26" fontWeight={700}>
            ZONA ORO — 25 mesas × 12 asientos
          </text>

          {/* VIP */}
          <rect
            x="990"
            y="80"
            width="350"
            height="600"
            fill="none"
            stroke="#1e62ff"
            strokeWidth={8}
            rx={14}
          />
          <text x="1010" y="120" fill="#e5e7eb" fontSize="26" fontWeight={700}>
            ZONA VIP — 15 mesas × 12 asientos
          </text>

          {/* MESAS + SILLAS */}
          {data.tables.map((table) => {
            return (
              <g key={table.id}>
                {renderTable(table)}
                {table.seats.map((s) => {
                  const sel = (selected[table.id] || []).includes(s.id);

                  // 👉 clave única mesa+asiento
                  const key = `${table.id}:${s.id}`;
                  const isBlocked = blockedKeys?.has(key) ?? false;

                  // estado base (lo que ya tenías)
                  const baseState =
                    s.status === "available" ? (sel ? "selected" : "available") : s.status;

                  // si está bloqueado, lo tratamos como reservado
                  const state = isBlocked ? "reserved" : baseState;

                  const fill = state === "selected" ? "#22c55e" : colorBy(state);

                  // si está activado "solo disponibles", escondemos todo lo que no sea available,
                  // excepto si ya está seleccionado
                  if (onlyAvailable && state !== "available" && !sel) return null;

                  return (
                    <g
                      key={s.id}
                      onClick={() => {
                        // ❗ no permitir seleccionar si está bloqueado y no estaba ya seleccionado
                        if (isBlocked && !sel) return;
                        // no permitir seleccionar si no es available y no estaba seleccionado
                        if (state !== "available" && !sel) return;
                        onToggle(table.id, s.id);
                      }}
                      style={{
                        cursor: isBlocked && !sel ? "not-allowed" : "pointer",
                        opacity: isBlocked && !sel ? 0.5 : 1,
                      }}
                    >
                      <circle
                        cx={s.x}
                        cy={s.y}
                        r={10}
                        fill={fill}
                        stroke="#111827"
                        strokeWidth={2}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}


          {/* Leyenda */}
          <g transform="translate(70, 720)">
            <rect x="0" y="-28" width="420" height="40" fill="#0f1629" rx="10" />
            <line x1="18" y1="-8" x2="60" y2="-8" stroke="#d4af37" strokeWidth={8} />
            <text x="70" y="-3" fill="#e5e7eb" fontSize="16">Marco Dorado = Zona ORO</text>
            <line x1="250" y1="-8" x2="292" y2="-8" stroke="#1e62ff" strokeWidth={8} />
            <text x="302" y="-3" fill="#e5e7eb" fontSize="16">Marco Azul = VIP</text>
          </g>
        </g>
      </svg>
    </div>
  );
}
