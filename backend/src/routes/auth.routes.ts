// src/routes/auth.routes.ts
import { Router } from "express";
import { login, register, me, refresh, logout } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Confirmar sesión y retornar perfil
router.get("/me", requireAuth, me); 

router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
