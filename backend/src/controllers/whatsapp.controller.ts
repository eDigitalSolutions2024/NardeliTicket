/*import { Request, Response } from "express";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import { ensureTicketPdf, ticketFilePath, ticketFileName } from "../utils/tickets";
import { sendWhatsAppDocument, sendWhatsAppText } from "../services/whatsapp";

const API_BASE =
  process.env.PUBLIC_API_BASE_URL ||
  // Fallback: construye desde el host del request
  ""; // si está vacío, construimos manual con req

function buildTicketPdfUrl(req: Request, ticketId: string) {
  // Tu backend ya expone: /api/checkout/tickets/:tid.pdf
  if (API_BASE) return `${API_BASE}/checkout/tickets/${ticketId}.pdf`;

  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host;
  return `${proto}://${host}/api/checkout/tickets/${ticketId}.pdf`;
}

export const sendTicketsController = async (req: Request, res: Response) => {
  try {
    const { phone, ticketIds, orderId, introMessage } = req.body || {};

    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone es requerido" });
    }
    if ((!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) && !orderId) {
      return res
        .status(400)
        .json({ ok: false, error: "Proporciona ticketIds[] o orderId" });
    }

    // (Opcional) si algún día quieres resolver ticketIds desde orderId,
    // aquí buscarías en la DB. Por ahora usamos ticketIds directos:
    const ids: string[] = ticketIds || [];

    if (introMessage) {
      await sendWhatsAppText(phone, introMessage);
    }

    const results: any[] = [];
    for (const tid of ids) {
      const pdfUrl = buildTicketPdfUrl(req, tid);
      const filename = `boleto_${tid}.pdf`;
      const caption = `Aquí está tu boleto (${tid}). ¡Gracias por tu compra!`;
      const r = await sendWhatsAppDocument(phone, pdfUrl, filename, caption);
      results.push({ tid, r });
    }

    return res.json({ ok: true, sent: results.length, results });
  } catch (err: any) {
    console.error("Error enviando boletos por WhatsApp:", err?.response?.data || err);
    return res.status(500).json({
      ok: false,
      error: err?.response?.data || err?.message || "Error interno",
    });
  }
};*/

import { Request, Response } from "express";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import { ensureTicketPdf } from "../utils/tickets"; // ← usamos ensureTicketPdf
import { sendWhatsAppDocument, sendWhatsAppText } from "../services/whatsapp";

/** Normaliza la base pública para construir URLs correctas del PDF.
 *  Acepta tanto "http://host:4000" como "http://host:4000/api".
 *  Siempre regresará algo que termina en "/api".
 */
const RAW_API_BASE = (process.env.PUBLIC_API_BASE_URL || "").trim();
const API_ROOT = RAW_API_BASE
  ? (() => {
      const base = RAW_API_BASE.replace(/\/+$/, "");      // quita / final
      return /\/api$/.test(base) ? base : `${base}/api`;  // asegura /api
    })()
  : ""; // si está vacío, construimos desde el request

function buildTicketPdfUrl(req: Request, ticketId: string) {
  if (API_ROOT) {
    return `${API_ROOT}/checkout/tickets/${ticketId}.pdf`;
  }
  // Fallback desde el request (útil en local si no seteaste PUBLIC_API_BASE_URL)
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.headers.host?.replace(/\/+$/, "") || "localhost";
  const base = `${proto}://${host}`;
  return `${base}/api/checkout/tickets/${ticketId}.pdf`;
}

export const sendTicketsController = async (req: Request, res: Response) => {
  try {
    const { phone, ticketIds, orderId, introMessage } = req.body || {};

    if (!phone) {
      return res.status(400).json({ ok: false, error: "phone es requerido" });
    }
    if ((!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) && !orderId) {
      return res.status(400).json({ ok: false, error: "Proporciona ticketIds[] o orderId" });
    }

    // Si algún día quieres resolver ticketIds desde orderId, aquí:
    const ids: string[] = ticketIds || [];

    // (Opcional) mensaje de texto previo
    if (introMessage) {
      try {
        await sendWhatsAppText(phone, introMessage);
      } catch (e) {
        // No bloquea el envío de los documentos
        console.warn("⚠️ No se pudo enviar el introMessage por WhatsApp:", (e as any)?.response?.data || (e as any)?.message);
      }
    }

    const results: any[] = [];
    for (const tid of ids) {
      const pdfUrl = buildTicketPdfUrl(req, tid);
      const filename = `boleto_${tid}.pdf`;
      const caption  = `Aquí está tu boleto (${tid}). ¡Gracias por tu compra!`;

      // Log útil para depurar "api/api" o URLs privadas:
      console.log("➡️ Enviando PDF por WhatsApp:", { tid, pdfUrl });

      const r = await sendWhatsAppDocument(phone, pdfUrl, filename, caption);
      results.push({ tid, r });
    }

    return res.json({ ok: true, sent: results.length, results });
  } catch (err: any) {
    console.error("Error enviando boletos por WhatsApp:", err?.response?.data || err);
    return res.status(500).json({
      ok: false,
      error: err?.response?.data || err?.message || "Error interno",
    });
  }
};
