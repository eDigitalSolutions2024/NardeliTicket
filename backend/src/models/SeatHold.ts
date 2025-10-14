import { Schema, model, Document } from "mongoose";

export interface ISeatHold extends Document {
  eventId: string;
  tableId: string;
  seatId: string;
  userId: string;
  orderId?: string;
  createdAt: Date;
}

const SeatHoldSchema = new Schema<ISeatHold>(
  {
    eventId: { type: String, index: true },
    tableId: String,
    seatId: String,
    userId: String,
    orderId: String,
  },
  { timestamps: true }
);

// Limpieza automática a los 15 minutos
SeatHoldSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15 * 60 });

export default model<ISeatHold>("SeatHold", SeatHoldSchema);
