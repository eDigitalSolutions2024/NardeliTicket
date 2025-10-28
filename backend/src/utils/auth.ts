import bcrypt from "bcryptjs";
import { sign, verify, JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";

/* ------------------ Password helpers ------------------ */
export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/* ------------------ JWT base helpers ------------------ */
export function signToken(
  payload: object,
  secret: string,
  expiresIn: string | number = "1d"
) {
  return sign(payload, secret, { expiresIn });
}
export function verifyToken<T = JwtPayload>(token: string, secret: string) {
  return verify(token, secret) as T;
}

/* ------------------ Access / Refresh helpers ------------------ */
const ACCESS_TTL = process.env.JWT_EXPIRES || "15m";
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// 🔒 Validación inmediata
if (!ACCESS_SECRET) {
  console.error("❌ Missing env JWT_SECRET");
  throw new Error("Missing env JWT_SECRET");
}
if (!REFRESH_SECRET) {
  console.error("❌ Missing env JWT_REFRESH_SECRET");
  throw new Error("Missing env JWT_REFRESH_SECRET");
}

/** Access token corto (~15m) */
export function signAccessToken(payload: object) {
  return sign(payload, ACCESS_SECRET!, { expiresIn: ACCESS_TTL });
}

/** Refresh token largo (~30d) */
export function signRefreshToken(payload: object & { jti?: string }) {
  const jti = payload.jti ?? randomUUID();
  const token = sign(
    { ...payload, jti },
    REFRESH_SECRET!,
    { expiresIn: `${REFRESH_TTL_DAYS}d` }
  );

  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}
