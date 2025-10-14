// src/app.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import eventsRouter from "./routes/events.routes";
import authRouter from "./routes/auth.routes";
import bodyParser from "body-parser";
import checkoutRoutes from "./routes/checkout.routes";
import webhookRoutes from "./routes/webhooks.routes";

const app = express();


app.use("/api/webhooks", webhookRoutes);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(bodyParser.json());


app.use("/api/checkout", checkoutRoutes);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/events", eventsRouter);

app.use("/api/auth", authRouter);
export default app;
