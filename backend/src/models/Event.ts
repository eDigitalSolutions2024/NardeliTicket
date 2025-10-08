// src/models/Event.ts
import { Schema, model, InferSchemaType } from "mongoose";

const SessionSchema = new Schema(
  {
    date: { type: Date, required: true },
  },
  { _id: true }
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
  },
  { timestamps: true }
);

export type EventDoc = InferSchemaType<typeof EventSchema>;
export const Event = model<EventDoc>("Event", EventSchema);
