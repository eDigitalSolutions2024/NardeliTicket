import { Schema, model, Document } from "mongoose";

type OrderItem = {
  zoneId: string;
  tableId: string;
  seatIds: string[];
  unitPrice: number;
};

export interface IOrder extends Document {
  userId: string;
  eventId: string;
  sessionDate?: Date;
  items: OrderItem[];
  totals: { subtotal: number; fees: number; total: number; seatCount: number };
  status: "pending" | "requires_payment" | "paid" | "canceled" | "expired";
  stripe?: { checkoutSessionId?: string; paymentIntentId?: string };
}

const ItemSchema = new Schema<OrderItem>(
  {
    zoneId: String,
    tableId: String,
    seatIds: [String],
    unitPrice: Number,
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: String, required: true }, // del token
    eventId: { type: String, required: true },
    sessionDate: Date,
    items: [ItemSchema],
    totals: {
      subtotal: Number,
      fees: Number,
      total: Number,
      seatCount: Number,
    },
    status: {
      type: String,
      enum: ["pending", "requires_payment", "paid", "canceled", "expired"],
      default: "pending",
    },
    stripe: {
      checkoutSessionId: String,
      paymentIntentId: String,
    },
  },
  { timestamps: true }
);

export default model<IOrder>("Order", OrderSchema);
