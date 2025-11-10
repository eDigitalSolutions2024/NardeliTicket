import bcrypt from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import type { JwtPayload, SignOptions, Secret } from "jsonwebtoken";
import { randomUUID } from "crypto";

/** Payload estándar que usaremos en tus controladores */
export type TokenPayload = {
  sub: string;                 // subject (id de usuario)
  jti?: string;                // id del token (para refresh)
  [k: string]: unknown;        // campos extra permitidos
};

/* ------------------ Password helpers ------------------ */
export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/* ------------------ JWT base helpers ------------------ */
/**
 * Firma un JWT con expiración y opciones extra.
 * Forzamos `secret` a `Secret` y validamos que no esté vacío
 * para que TypeScript seleccione la sobrecarga correcta.
 */
export function signToken(
  payload: Record<string, unknown>,
  secret: Secret,
  expiresIn: string | number = "1d",
  options: Omit<SignOptions, "expiresIn"> = {}
): string {
  // Validación para evitar que TS piense que secret es null/undefined
  if (
    secret == null ||
    (typeof secret === "string" && secret.trim().length === 0)
  ) {
    throw new Error("Missing JWT secret");
  }

  return sign(payload, secret, { ...options, expiresIn });
}

/** Verifica un JWT y devuelve su payload tipado */
export function verifyToken<T = JwtPayload>(token: string, secret: Secret): T {
  if (
    secret == null ||
    (typeof secret === "string" && secret.trim().length === 0)
  ) {
    throw new Error("Missing JWT secret");
  }
  return verify(token, secret) as T;
}

/* ------------------ Access / Refresh helpers ------------------ */
const ACCESS_TTL = process.env.JWT_EXPIRES ?? "15m";
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS ?? 30);

const ACCESS_SECRET = process.env.JWT_SECRET as string | undefined;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string | undefined;

// 🔒 Validación temprana (falla al arrancar si faltan)
if (!ACCESS_SECRET) throw new Error("❌ Missing env JWT_SECRET");
if (!REFRESH_SECRET) throw new Error("❌ Missing env JWT_REFRESH_SECRET");

/** Access token corto (~15m) */
export function signAccessToken(payload: TokenPayload) {
  return signToken(payload, ACCESS_SECRET!, ACCESS_TTL);
}

/** Refresh token largo (~30d) – genera jti si no existe */
export function signRefreshToken(payload: TokenPayload) {
  const jti = payload.jti ?? randomUUID();

  const token = signToken(
    { ...payload, jti },
    REFRESH_SECRET!,
    `${REFRESH_TTL_DAYS}d`
  );

  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}
