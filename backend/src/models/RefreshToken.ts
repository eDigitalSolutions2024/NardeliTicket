import mongoose from "mongoose";

const RefreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    jti: { type: String, unique: true, index: true, required: true },
    revoked: { type: Boolean, default: false },
    expiresAt: { type: Date, index: true, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("RefreshToken", RefreshTokenSchema);
