// src/controllers/account.controller.ts
import { RequestHandler } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";

export const getAccount: RequestHandler = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "No autorizado" });

  const user = await User.findById(uid).lean();
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const { passwordHash, ...safe } = user as any;
  return res.json(safe);
};

export const updateProfile: RequestHandler = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "No autorizado" });

  const { name, phone } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "El nombre es requerido" });
  }

  const user = await User.findByIdAndUpdate(
    uid,
    { $set: { name: String(name).trim(), ...(phone ? { phone: String(phone).trim() } : {}) } },
    { new: true }
  ).lean();

  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const { passwordHash, ...safe } = user as any;
  return res.json(safe);
};

export const changePassword: RequestHandler = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "No autorizado" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Faltan campos" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  const user = await User.findById(uid);
  if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) return res.status(400).json({ message: "Contraseña actual incorrecta" });

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  return res.json({ ok: true });
};
