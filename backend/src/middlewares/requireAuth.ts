import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const secret = process.env.JWT_SECRET!;
    const payload = verifyToken(token, secret);
    (req as any).user = payload; // { id, role }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}
