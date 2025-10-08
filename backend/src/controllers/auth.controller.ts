import { Request, Response } from "express";
import { User } from "../models/User";
import { hashPassword, comparePassword, signToken } from "../utils/auth";

function toPublic(u: any) {
  return { id: u._id.toString(), name: u.name, email: u.email, role: u.role };
}

export async function register(req: Request, res: Response) {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: role === "admin" ? "admin" : "user" });

  const token = signToken({ id: user._id, role: user.role }, process.env.JWT_SECRET!, process.env.JWT_EXPIRES || "1d");
  res.status(201).json({ user: toPublic(user), token });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const user = await User.findOne({ email, isActive: true });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user._id, role: user.role }, process.env.JWT_SECRET!, process.env.JWT_EXPIRES || "1d");
  res.json({ user: toPublic(user), token });
}

export async function me(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: toPublic(user) });
}
