// src/models/Event.ts
import { Schema, model, InferSchemaType } from "mongoose";

const SessionSchema = new Schema(
  {
    date: { type: Date, required: true },
  },
  { _id: true }
);

const PricingSchema = new Schema(
  {
    vip: { type: Number, min: 0, default: 0 },  // precio en MXN
    oro: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const EventSchema = new Schema(
  {
    title:    { type: String, required: true, index: "text" },
    venue:    { type: String, required: true },
    city:     { type: String, required: true },
    imageUrl: { type: String, required: true },
    category: { type: String, enum: ["Conciertos","Teatro","Deportes","Familiares","Especiales"] },
    sessions: { type: [SessionSchema], default: [] },

    // Si agregaste estos campos en tu UI:
    status:   { type: String, enum: ["draft","published"], default: "draft" },
    featured: { type: Boolean, default: false },
    // 👇 NUEVO
    pricing: { type: PricingSchema, default: () => ({ vip: 0, oro: 0 }) },
  },
  { timestamps: true }
);

export type EventDoc = InferSchemaType<typeof EventSchema>;
export const Event = model<EventDoc>("Event", EventSchema);
