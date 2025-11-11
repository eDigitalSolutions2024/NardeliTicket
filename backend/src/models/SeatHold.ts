import { Schema, model, Document } from "mongoose";

export interface ISeatHold extends Document {
  eventId: string;
  tableId?: string;    // opcional por si hay holds de zona sin mesa fija
  seatId?: string;     // igual opcional si a veces se aparta por zona
  userId: string;
  orderId?: string;
  createdAt: Date;
  holdGroup: string;
  expiresAt?: Date;    // si vendes, puedes quitar expiresAt para que no expiren
  status: "active" | "attached_to_order" | "released" | "sold";
  eventLayoutVersion?: number;

  // NUEVO: usado por el controlador
  zoneId?: string;
  // (si tenías data vieja con 'zone', puedes mapearla en el controlador)
}

const SeatHoldSchema = new Schema<ISeatHold>(
  {
    eventId: { type: String, index: true },
    holdGroup: { type: String, index: true },
    // crea el hold con vencimiento a 15 min
    expiresAt: { type: Date, default: () => new Date(Date.now() + 15 * 60 * 1000) },
    status: { type: String, enum: ["active","attached_to_order","released","sold"], default: "active" },
    eventLayoutVersion: { type: Number },
    tableId: String,
    seatId: String,
    userId: String,
    orderId: String,

    // NUEVO
    zoneId: String,
  },
  { timestamps: true }
);

/**
 * TTL: usa el campo 'expiresAt' como TTL para limpiar holds.
 * IMPORTANTE: TTL en Mongo es por campo de fecha; si un doc NO tiene expiresAt, NO expira.
 * - Para 'sold' o 'attached_to_order', puedes 'unset' de expiresAt al confirmar, así NO se borra.
 */
SeatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Unicidad:
 * - Solo un 'active' por (eventId, seatId)
 * - Solo un 'sold'  por (eventId, seatId)
 * Así evitas conflictos entre estados y puedes transicionar de active→sold sin duplicados simultáneos.
 */
SeatHoldSchema.index(
  { eventId: 1, seatId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

SeatHoldSchema.index(
  { eventId: 1, seatId: 1 },
  { unique: true, partialFilterExpression: { status: "sold" } }
);

// (Si quieres incluir 'zoneId' en la unicidad cuando NO hay seatId, agrega índices análogos para (eventId, zoneId))

export default model<ISeatHold>("SeatHold", SeatHoldSchema);
