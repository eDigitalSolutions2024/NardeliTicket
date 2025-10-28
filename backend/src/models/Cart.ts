// models/Cart.ts
import { Schema, model, Types } from "mongoose";

const CartItem = new Schema({
  eventId: { type: Types.ObjectId, ref: "Event", required: true },
  seats:   [{ type: String, required: true }], // S172, etc.
  price:   { type: Number, required: true },   // precio por asiento/mesa
}, { _id: false });

const CartSchema = new Schema({
  userId:    { type: Types.ObjectId, ref: "User" },    // si logueado
  sessionId: { type: String },                         // si anónimo
  items:     { type: [CartItem], default: [] },
  updatedAt: { type: Date, default: Date.now }
});
CartSchema.index({ userId: 1 });
CartSchema.index({ sessionId: 1 });

export default model("Cart", CartSchema);
