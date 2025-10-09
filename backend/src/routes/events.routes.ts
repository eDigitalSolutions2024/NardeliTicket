import { Router } from "express";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/events.controller";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";

const router = Router();

// Público (NO deben pedir token)
router.get("/", listEvents);
router.get("/:id", getEvent);

// Solo ADMIN
router.post("/", requireAuth, requireAdmin, createEvent);
router.put("/:id", requireAuth, requireAdmin, updateEvent);
router.delete("/:id", requireAuth, requireAdmin, deleteEvent);

export default router;
