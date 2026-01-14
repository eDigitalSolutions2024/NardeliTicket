import { Schema, model, Document } from "mongoose";

export interface ISeatHold extends Document {
  eventId: string;
  sessionId: string;
  tableId?: string;    // opcional por si hay holds de zona sin mesa fija
  seatId?: string; 
  tableLabel?: string;
  seatLabel?: string;    // igual opcional si a veces se aparta por zona
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
    sessionId: { type: String, index: true, required: true },
    holdGroup: { type: String, index: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 15 * 60 * 1000) },
    status: { type: String, enum: ["active","attached_to_order","released","sold"], default: "active" },
    eventLayoutVersion: { type: Number },
    tableId: String,
    seatId: String,
    tableLabel: String,
    seatLabel: String,
    userId: String,
    orderId: String,

    // NUEVO
    zoneId: String,
  },
  { timestamps: true }
);


SeatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

SeatHoldSchema.index(
  { eventId: 1, sessionId: 1, tableId: 1, seatId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active", seatId: { $exists: true, $type: "string" } },
  }
);

SeatHoldSchema.index(
  { eventId: 1, sessionId: 1, tableId: 1, seatId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "sold", seatId: { $exists: true, $type: "string" } },
  }
);



// (Si quieres incluir 'zoneId' en la unicidad cuando NO hay seatId, agrega índices análogos para (eventId, zoneId))

export default model<ISeatHold>("SeatHold", SeatHoldSchema);
