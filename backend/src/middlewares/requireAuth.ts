import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth";

/**
 * Acepta tokens firmados con { sub, role } (nuevo) o { id, role } (legacy).
 * Inyecta en req.user: { id: string, role?: string }
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req.headers.authorization || "").trim();
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }

    const token = auth.slice(7).trim();
    if (!token) return res.status(401).json({ error: "Missing token" });

    const secret = process.env.JWT_SECRET!;
    const payload: any = verifyToken(token, secret); // puede traer sub o id

    const userId = payload?.sub ?? payload?.id;
    if (!userId) return res.status(401).json({ error: "Bad token payload" });

    (req as any).user = {
      id: String(userId),
      role: payload?.role,
      // agrega aquí otros campos si los firmas (email, name, etc.)
    };

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
