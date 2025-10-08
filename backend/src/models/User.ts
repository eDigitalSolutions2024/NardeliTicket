import { Schema, model, InferSchemaType } from "mongoose";

const UserSchema = new Schema({
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin","user"], default: "user" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = model<UserDoc>("User", UserSchema);
