// src/layout/salonLayout.ts

// Tipos internos para la geometría
type SeatStatus = "available" | "reserved" | "held";

export type SeatNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  status: SeatStatus;
  zoneId: "VIP" | "ORO";
  tableId: string;
};

export type TableGeom = {
  id: string;
  name: string;
  zoneId: "VIP" | "ORO";
  seats: SeatNode[];
  capacity: number;
  cx: number;
  cy: number;
};

// Tamaño visual de las mesas (lo usaremos también en el SVG)
export const TABLE_W = 190;
export const TABLE_H = 120;
export const TABLE_R = 18;

// Paso base del grid
const STEP_X = 340;
const STEP_Y = 250;

// Offsets para el patrón de asientos alrededor de la mesa
const VIP_OFFSETS = { topY: -90, bottomY: 90, leftX: -120, rightX: 120 };
const ORO_OFFSETS = { topY: -90, bottomY: 90, leftX: -120, rightX: 120 };

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
  // fila superior: 4 asientos
  [-54, topY],
  [-18, topY],
  [18, topY],
  [54, topY],

  // fila inferior: 4 asientos
  [-54, bottomY],
  [-18, bottomY],
  [18, bottomY],
  [54, bottomY],

  // laterales: 1 a cada lado
  [leftX, 0],
  [rightX, 0],
];

const SEAT_PATTERN_VIP = makePattern(VIP_OFFSETS);
const SEAT_PATTERN_ORO = makePattern(ORO_OFFSETS);

// Helper para letras A, B, C...
export const numToLetter = (n: number) =>
  String.fromCharCode("A".charCodeAt(0) + (n - 1));

// Offsets manuales por mesa (ajustan al plano real)
const TABLE_OFFSETS: Record<string, { dx: number; dy: number }> = {
  // Asientos VIP
  "VIP-01": { dx: 100, dy: -50 },
  "VIP-02": { dx: 50, dy: -50 },

  "VIP-03": { dx: STEP_X * -1.72, dy: 210 },
  "VIP-04": { dx: 390, dy: -39 },

  "VIP-05": { dx: -245, dy: 190 },
  "VIP-06": { dx: -290, dy: 190 },

  "VIP-07": { dx: 95, dy: 170 },
  "VIP-08": { dx: 50, dy: 170 },

  "VIP-09": { dx: -585, dy: 400 },
  "VIP-10": { dx: 390, dy: 150 },

  "VIP-11": { dx: -245, dy: 380 },
  "VIP-12": { dx: -290, dy: 380 },

  "VIP-13": { dx: 95, dy: 360 },
  "VIP-14": { dx: 50, dy: 360 },

  // mesa que no se mostrará (la mandas lejos)
  "VIP-15": { dx: -175, dy: 10000 * STEP_Y },

  // Asientos en ORO
  "ORO-01": { dx: -1300, dy: -190 },

  "ORO-02": { dx: -1640, dy: 1500 },
  "ORO-03": { dx: -1980, dy: 1720 },
  "ORO-04": { dx: -1430, dy: -50 },
  "ORO-05": { dx: -1770, dy: 210 },
  "ORO-06": { dx: -410, dy: 190 },
  "ORO-07": { dx: -750, dy: 420 },
  "ORO-08": { dx: -1090, dy: 650 },
  "ORO-09": { dx: -1430, dy: 880 },
  "ORO-10": { dx: -1770, dy: 1110 },

  "ORO-11": { dx: -120, dy: -550 },
  "ORO-12": { dx: -460, dy: -290 },
  "ORO-13": { dx: -800, dy: -60 },
  "ORO-14": { dx: -1140, dy: 170 },
  "ORO-15": { dx: -1480, dy: 400 },
  "ORO-16": { dx: -120, dy: 380 },
  "ORO-17": { dx: -460, dy: 830 },

  "ORO-18": { dx: -510, dy: -800 },
  "ORO-19": { dx: -850, dy: -540 },
  "ORO-20": { dx: -1190, dy: -310 },
  "ORO-21": { dx: 170, dy: -330 },
  "ORO-22": { dx: -170, dy: -100 },
  "ORO-23": { dx: -510, dy: 130 },

  "ORO-24": { dx: 0, dy: 100000000 },
  "ORO-25": { dx: 0, dy: 1000000 },
};

type TableDef = {
  id: string;
  zoneId: "VIP" | "ORO";
  name: string;
  cx: number;
  cy: number;
};

// Definición base de mesas (sin asientos)
const TABLE_DEFS: TableDef[] = (() => {
  const defs: TableDef[] = [];

  // ----- ZONA VIP (3 x 5) -----
  const vipOrigin = { x: 260, y: 300 };
  let tVip = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      tVip++;
      const id = `VIP-${String(tVip).padStart(2, "0")}`;

      let cx = vipOrigin.x + c * STEP_X;
      let cy = vipOrigin.y + r * STEP_Y;

      const off = TABLE_OFFSETS[id];
      if (off) {
        cx += off.dx;
        cy += off.dy;
      }

      defs.push({ id, zoneId: "VIP", name: `Mesa VIP ${tVip}`, cx, cy });
    }
  }

  // ----- ZONA ORO (5 x 5) -----
  const oroOrigin = { x: 1350, y: 300 };
  let tOro = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      tOro++;
      const id = `ORO-${String(tOro).padStart(2, "0")}`;

      let cx = oroOrigin.x + c * STEP_X;
      let cy = oroOrigin.y + r * STEP_Y;

      const off = TABLE_OFFSETS[id];
      if (off) {
        cx += off.dx;
        cy += off.dy;
      }

      defs.push({ id, zoneId: "ORO", name: `Mesa Oro ${tOro}`, cx, cy });
    }
  }

  return defs;
})();

// 🧠 Constructor final: genera todas las mesas con sus asientos
export function buildTables(): TableGeom[] {
  const out: TableGeom[] = [];
  let seatGlobal = 0;

  TABLE_DEFS.forEach((def) => {
    const pattern = def.zoneId === "VIP" ? SEAT_PATTERN_VIP : SEAT_PATTERN_ORO;

    const seats: SeatNode[] = pattern.map(([dx, dy], i) => {
      seatGlobal++;
      const tableNumber = parseInt(def.id.split("-")[1] || "1", 10) || 1;
      const tableLetter = numToLetter(tableNumber); // A, B, C...

      return {
        id: `S${seatGlobal}`,
        label: `${tableLetter}${i + 1}`, // A1, A2, etc.
        x: def.cx + dx,
        y: def.cy + dy,
        status: "available",
        zoneId: def.zoneId,
        tableId: def.id,
      };
    });

    out.push({
      id: def.id,
      name: def.name,
      zoneId: def.zoneId,
      seats,
      capacity: seats.length,
      cx: def.cx,
      cy: def.cy,
    });
  });

  return out;
}
