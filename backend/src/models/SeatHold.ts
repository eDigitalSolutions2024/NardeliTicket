import { Schema, model, Document } from "mongoose";

export interface ISeatHold extends Document {
  eventId: string;
  tableId: string;
  seatId: string;
  userId: string;
  orderId?: string;
  createdAt: Date;
  holdGroup: string;
  expiresAt: Date;
  status: "active" | "attached_to_order" | "released" | "sold";
  eventLayoutVersion?: number;
}

const SeatHoldSchema = new Schema<ISeatHold>(
  {
    eventId: { type: String, index: true },
    holdGroup: { type: String, index: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 15* 60 * 1000) },
    status: {type: String, enum: ["active","attached_to_order","released","sold"], default: "active" },
    eventLayoutVersion : {type: Number },
    tableId: String,
    seatId: String,
    userId: String,
    orderId: String,
  },
  { timestamps: true }
);

// Limpieza automática a los 15 minutos
SeatHoldSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15 * 60 });

// Evita que dos usuarios tengan el mismo asiento en "active"
SeatHoldSchema.index(
  { eventId: 1, seatId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

// Unicidad en SOLD
SeatHoldSchema.index(
  { eventId: 1, seatId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "sold" } }
);

export default model<ISeatHold>("SeatHold", SeatHoldSchema);
