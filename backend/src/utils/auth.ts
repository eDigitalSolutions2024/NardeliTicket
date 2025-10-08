import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: object, secret: string, expiresIn = "1d") {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token: string, secret: string) {
  return jwt.verify(token, secret) as any;
}
