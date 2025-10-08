import { Router } from "express";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/events.controller";

const router = Router();

// TODO: aquí después pondremos middleware de auth para admin
router.get("/", listEvents);
router.get("/:id", getEvent);
router.post("/", createEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

export default router;
