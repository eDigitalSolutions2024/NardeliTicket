// src/middlewares/authOptional.ts
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

export const authOptional: RequestHandler = (req: any, _res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      // token inválido: ignoramos, seguimos sin user
    }
  }
  next();
};
