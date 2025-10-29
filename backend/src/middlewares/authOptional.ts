// src/middlewares/authOptional.ts
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

export const authOptional: RequestHandler = (req: any, _res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;

  if (token) {
    try {
      // acepta payloads { sub, role } o legacy { id, role }
      const p: any = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = {
        id: String(p?.sub ?? p?.id ?? ""),
        role: p?.role,
        email: p?.email,
        name: p?.name,
      };
    } catch {
      // token inválido → seguimos sin user
    }
  }
  next();
};
