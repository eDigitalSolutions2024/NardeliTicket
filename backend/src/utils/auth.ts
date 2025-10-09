// src/utils/auth.ts
import bcrypt from "bcryptjs";
import { sign, verify, JwtPayload } from "jsonwebtoken";

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: object, secret: string, expiresIn: string | number = "1d") {
  return sign(payload, secret, { expiresIn });
}
export function verifyToken<T = JwtPayload>(token: string, secret: string) {
  return verify(token, secret) as T;
}
