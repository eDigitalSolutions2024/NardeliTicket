// src/server.ts
import "dotenv/config";
import mongoose from "mongoose";

// src/server.ts
import "dotenv/config";
console.log("ENV check:", {
  hasJWT: !!process.env.JWT_SECRET,
  hasRefresh: !!process.env.JWT_REFRESH_SECRET,
  nodeEnv: process.env.NODE_ENV,
  cwd: process.cwd(),
});
import app from "./app";

const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/nardeli_ticket";

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Mongo conectado");
    app.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ Error al iniciar:", err);
    process.exit(1);
  }
}

start();
