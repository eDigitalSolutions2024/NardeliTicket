// src/middlewares/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth";

type JwtPayloadLite = { sub?: string; id?: string; role?: string; email?: string; name?: string };

function extractBearer(req: Request): string | null {
  const hdr = (req.headers.authorization || "").trim();
  if (!hdr) return null;
  const [scheme, ...rest] = hdr.split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim().replace(/^"(.*)"$/, "$1");
  if (!token || token === "undefined" || token === "null") return null;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET is not set");
      return res.status(500).json({ error: "server_misconfigured" });
    }

    let token = extractBearer(req);
    if (!token) return res.status(401).json({ error: "Missing token" });

    const payload = verifyToken<JwtPayloadLite>(token, secret);
    const userId = payload?.sub ?? payload?.id;
    if (!userId) return res.status(401).json({ error: "Bad token payload" });

    (req as any).user = {
      id: String(userId),
      role: payload?.role,
      email: payload?.email,
      name: payload?.name,
    };
    (req as any).authToken = token;

    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}
