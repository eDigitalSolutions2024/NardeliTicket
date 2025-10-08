import { Router } from "express";
import { login, register, me } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
router.post("/register", register);  // puedes limitar a admin luego
router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
