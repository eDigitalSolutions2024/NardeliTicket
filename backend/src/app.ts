// src/app.ts
import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import eventsRouter from "./routes/events.routes";
import authRouter from "./routes/auth.routes";
import checkoutRoutes from "./routes/checkout.routes";
import webhookRoutes from "./routes/webhooks.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import adminSalesRoutes from "./routes/admin.sales.routes";

const app = express();

/** 1) CORS con credenciales y origin explícito (usa FRONTEND_URL si la tienes) */
const FRONT = process.env.FRONTEND_URL || process.env.PUBLIC_URL || "http://localhost:5173";
app.use(
  cors({
    origin: [FRONT],
    credentials: true,
  })
);

/** 2) Cookies ANTES de rutas que leen req.cookies */
app.use(cookieParser());

/** 3) Stripe webhooks con RAW body ANTES de cualquier parser JSON */
app.use("/api/webhooks", webhookRoutes);

/** 4) Logs */
app.use(morgan("dev"));

/** 5) Parsers normales para el resto de rutas */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** 6) Rutas API */
app.use("/api/auth", authRouter);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/events", eventsRouter);
app.use("/api/admin", adminSalesRoutes);
app.use("/api/whatsapp", whatsappRoutes);

/** 7) Estáticos (PDFs, etc.) */
app.use(
  "/files",
  express.static(path.join(__dirname, "tickets"), { fallthrough: true })
);

/** 8) Healthcheck */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

export default app;
