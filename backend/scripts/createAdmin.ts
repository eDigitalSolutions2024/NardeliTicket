// scripts/createAdmin.ts
import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../src/models/User";
import { hashPassword } from "../src/utils/auth";

/**
 * Uso:
 *  - Con .env:
 *      ADMIN_NAME=Admin
 *      ADMIN_EMAIL=admin@nardeli.local
 *      ADMIN_PASSWORD=admin123
 *    Ejecuta:  npm run seed:admin
 *
 *  - Por CLI (sobrescribe .env):
 *      npm run seed:admin -- "Admin Name" admin@site.com superpass
 */

async function main() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/nardeli_ticket";
  const nameArg = process.argv[2];
  const emailArg = process.argv[3];
  const passArg = process.argv[4];

  const name = (nameArg || process.env.ADMIN_NAME || "Admin").trim();
  const email = (emailArg || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = (passArg || process.env.ADMIN_PASSWORD || "").trim();

  if (!email || !password) {
    console.error("❌ Falta EMAIL o PASSWORD.");
    console.error('   Usa: npm run seed:admin -- "Admin Name" admin@mail.com mypassword');
    console.error("   O configura .env: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅ Conectado a Mongo");

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "admin") {
      existing.role = "admin";
    }
    if (!existing.passwordHash) {
      existing.passwordHash = await hashPassword(password);
    }
    await existing.save();
    console.log(`ℹ️  Usuario ya existía. Asegurado como admin: ${existing.email}`);
  } else {
    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "admin",
      isActive: true,
    });
    console.log(`✅ Admin creado: ${user.email}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Error creando admin:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
