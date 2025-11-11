// src/utils/auth.ts
import bcrypt from "bcryptjs";
import { sign, verify, JwtPayload, type SignOptions, type Secret } from "jsonwebtoken";
import { randomUUID } from "crypto";

/* ======================= Password ======================= */
export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/* ================== Helpers base JWT ==================== */
/** Firma un token tipado sin chocar con las sobrecargas de jsonwebtoken v9. */
export function signToken(
  payload: Record<string, unknown>,
  secret: Secret,
  options: SignOptions = { expiresIn: "1d" as const } // 👈 literal const
) {
  if (!secret) throw new Error("Missing JWT secret");
  return sign(payload, secret, options);
}

export function verifyToken<T = JwtPayload>(token: string, secret: Secret) {
  return verify(token, secret) as T;
}

/* ========== Access / Refresh con validaciones =========== */
export type TokenPayload = {
  sub: string; // id de usuario como string
  [k: string]: unknown;
};

// Asegura tipos compatibles con jsonwebtoken v9
const ACCESS_TTL = (process.env.JWT_EXPIRES ?? "15m") as SignOptions["expiresIn"];
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30);

const ACCESS_SECRET = process.env.JWT_SECRET as Secret | undefined;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as Secret | undefined;

if (!ACCESS_SECRET) throw new Error("Missing env JWT_SECRET");
if (!REFRESH_SECRET) throw new Error("Missing env JWT_REFRESH_SECRET");

/** Access token (~15m) */
export function signAccessToken(payload: TokenPayload) {
  return sign(payload, ACCESS_SECRET!, { expiresIn: ACCESS_TTL });
}

/** Refresh token (~30d) con jti */
export function signRefreshToken(payload: Partial<TokenPayload> & { jti?: string }) {
  const jti = payload.jti ?? randomUUID();
  const refreshExpiresIn = `${REFRESH_TTL_DAYS}d` as const; // 👈 literal const

  const token = sign({ ...payload, jti }, REFRESH_SECRET!, {
    expiresIn: refreshExpiresIn,
  });

  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}
