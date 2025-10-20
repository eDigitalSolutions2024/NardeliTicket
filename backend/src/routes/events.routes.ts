import { Router } from "express";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getBlockedSeats,
} from "../controllers/events.controller";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth";

const router = Router();

// Público (NO deben pedir token)
router.get("/", listEvents);

router.get("/:eventId/blocked", getBlockedSeats); 

router.get("/:id", getEvent);

// Solo ADMIN
router.post("/", requireAuth, requireAdmin, createEvent);
router.put("/:id", requireAuth, requireAdmin, updateEvent);
router.delete("/:id", requireAuth, requireAdmin, deleteEvent);

export default router;
