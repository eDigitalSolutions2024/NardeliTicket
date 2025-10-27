import { Request, Response } from "express";
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
};