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
import accountRoutes from "./routes/account.routes";
const app = express();

// 👇 añade esta línea
app.set("trust proxy", 1);

/** 1) CORS — origen del frontend (separado de PUBLIC_URL que es del backend) */
const FRONT =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

app.use(
  cors({
    origin: [FRONT, "http://localhost:5173", "http://localhost:4173"],
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
app.use("/api/account", accountRoutes);

/** 7) Estáticos (PDFs, etc.) */
app.use(
  "/files/tickets",
  express.static(path.join(__dirname, "tickets"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".pdf")) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'inline; filename="boletos.pdf"');
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  })
);

// Carpeta estática para las imágenes subidas
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "uploads"))
);

/** 8) Healthcheck */
app.get("/api/health", (_req, res) => res.json({ ok: true }));

export default app;
