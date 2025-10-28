// src/app.ts
import path from "path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import eventsRouter from "./routes/events.routes";
import authRouter from "./routes/auth.routes";
import bodyParser from "body-parser";
import checkoutRoutes from "./routes/checkout.routes";
import webhookRoutes from "./routes/webhooks.routes";
import whatsappRoutes from "./routes/whatsapp.routes";
import adminSalesRoutes from "./routes/admin.sales.routes";
import cookieParser from "cookie-parser";

const app = express();



// ⚠️ Stripe webhooks primero (suelen requerir raw body)
app.use("/api/webhooks", webhookRoutes);

// ✅ CORS con credenciales ANTES de rutas
app.use(
  cors({
    origin: [process.env.PUBLIC_URL || "http://localhost:5173"],
    credentials: true,
  })
);

// ✅ Cookies ANTES de /api/auth para leer `rt`
app.use(cookieParser());

// JSON/logging
app.use(express.json());
app.use(morgan("dev"));
app.use(bodyParser.json());

// estáticos
app.use(
  "/files",
  express.static(path.join(__dirname, "tickets"), { fallthrough: true })
);

// rutas
app.use("/api/checkout", checkoutRoutes);
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/events", eventsRouter);
app.use("/api/admin",adminSalesRoutes);   // sin prefijo
app.use("/api/auth", authRouter);
app.use("/api/whatsapp", whatsappRoutes);

export default app;
