// src/routes/account.routes.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { getAccount, updateProfile, changePassword } from "../controllers/account.controller";

const router = Router();

router.get("/me", requireAuth, getAccount);
router.put("/profile", requireAuth, updateProfile);
router.put("/password", requireAuth, changePassword);

export default router;
