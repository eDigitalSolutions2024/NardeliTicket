// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import RefreshToken from "../models/RefreshToken";
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
} from "../utils/auth";

function toPublic(u: any) {
  return { id: u._id.toString(), name: u.name, email: u.email, role: u.role };
}

function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  // Si tu front corre en dominio distinto al API en PROD usa SameSite=None + Secure
  const sameSite = isProd ? ("none" as const) : ("lax" as const);
  return {
    httpOnly: true,
    sameSite,
    secure: isProd,
    path: "/api/auth",
    maxAge: 1000 * 60 * 60 * 24 * Number(process.env.REFRESH_TTL_DAYS || 30),
  };
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("rt", token, refreshCookieOptions());
}

/* --------------------------- REGISTER --------------------------- */
export async function register(req: Request, res: Response) {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: role === "admin" ? "admin" : "user",
  });

  const accessToken = signAccessToken({ sub: user._id, role: user.role });
  const { token: refreshToken, jti, expiresAt } = signRefreshToken({
    sub: user._id,
    role: user.role,
  });
  await RefreshToken.create({ userId: user._id, jti, expiresAt, revoked: false });
  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    user: toPublic(user),
    accessToken,
    token: accessToken, // compat legacy
  });
}

/* ----------------------------- LOGIN ---------------------------- */
export async function login(req: Request, res: Response) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  const user = await User.findOne({ email, isActive: true });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = signAccessToken({ sub: user._id, role: user.role });
  const { token: refreshToken, jti, expiresAt } = signRefreshToken({
    sub: user._id,
    role: user.role,
  });

  await RefreshToken.create({ userId: user._id, jti, expiresAt, revoked: false });
  setRefreshCookie(res, refreshToken);

  res.json({
    user: toPublic(user),
    accessToken,
    token: accessToken, // compat legacy
  });
}

/* ------------------------------- ME ----------------------------- */
export async function me(req: Request, res: Response) {
  const bearer = req.headers.authorization || "";
  const raw = bearer.startsWith("Bearer ") ? bearer.slice(7) : null;

  if (!raw && !(req as any).user?.id) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const userId =
      (req as any).user?.id ||
      (jwt.verify(raw!, process.env.JWT_SECRET as string) as any)?.sub ||
      (jwt.verify(raw!, process.env.JWT_SECRET as string) as any)?.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Not found" });

    res.json({ user: toPublic(user) });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ---------------------------- REFRESH --------------------------- */
export async function refresh(req: Request, res: Response) {
  const token = (req as any).cookies?.rt;
  if (!token) return res.status(401).json({ message: "No refresh cookie" });

  try {
    const payload: any = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string);
    const stored = await RefreshToken.findOne({ jti: payload.jti, userId: payload.sub });
    if (!stored || stored.revoked) {
      return res.status(401).json({ message: "Invalid refresh" });
    }
    if (stored.expiresAt && stored.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ message: "Refresh expired" });
    }

    // Rotación de refresh
    stored.revoked = true;
    await stored.save();

    const accessToken = signAccessToken({ sub: payload.sub, role: payload.role });
    const { token: newRefresh, jti: newJti, expiresAt } = signRefreshToken({
      sub: payload.sub,
      role: payload.role,
    });
    await RefreshToken.create({ userId: payload.sub, jti: newJti, expiresAt, revoked: false });

    setRefreshCookie(res, newRefresh);
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: "Expired/invalid refresh" });
  }
}

/* ----------------------------- LOGOUT --------------------------- */
export async function logout(req: Request, res: Response) {
  const token = (req as any).cookies?.rt;
  if (token) {
    try {
      const payload: any = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string);
      await RefreshToken.updateOne({ jti: payload.jti }, { $set: { revoked: true } });
    } catch {
      // ignorar
    }
  }
  // Borra la cookie usando exactamente las mismas opciones (path/samesite/secure)
  res.clearCookie("rt", refreshCookieOptions());
  res.json({ ok: true });
}
