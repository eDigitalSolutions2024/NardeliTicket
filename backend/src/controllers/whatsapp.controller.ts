// src/controllers/sendTickets.controller.ts
import { Request, Response } from "express";
import Order from "../models/Order";
import SeatHold from "../models/SeatHold";
import {
  ensureTicketPdf,
  ticketFilePath,
  ticketFileName,
} from "../utils/tickets";
import {
  sendWhatsAppText,
  sendWhatsAppDocumentFromFile,
  sendWhatsAppDocument, // fallback por link
} from "../services/whatsapp";

/** Normaliza una base pública para construir URLs de fallback (enlace). */
const RAW_API_BASE = (process.env.PUBLIC_API_BASE_URL || "").trim();
const API_ROOT = RAW_API_BASE
  ? (() => {
      const base = RAW_API_BASE.replace(/\/+$/, "");
      return /\/api$/.test(base) ? base : `${base}/api`;
    })()
  : "";

function buildTicketPdfUrl(req: Request, ticketId: string) {
  if (API_ROOT) return `${API_ROOT}/checkout/tickets/${ticketId}.pdf`;
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = (req.headers.host || "").replace(/\/+$/, "");
  return `${proto}://${host}/api/checkout/tickets/${ticketId}.pdf`;
}

/** Resuelve {order, seat} para un ticketId dado. Sirve si aún no existe el PDF. */
async function resolveOrderAndSeatForTicket(ticketId: string) {
  // 1) Intento vía Order.tickets
  const order =
    (await Order.findOne({ "tickets.ticketId": ticketId }).lean()) ||
    // 2) Intento vía SeatHold (sold) -> orderId
    (async () => {
      const sh = await SeatHold.findById(ticketId).lean();
      if (!sh?.orderId) return null;
      return Order.findById(sh.orderId).lean();
    })();

  const resolvedOrder = await order;
  if (!resolvedOrder) return { order: null as any, seat: null as any };

  // Seat básico (para el PDF)
  // Busca primero en tickets; si no, en SeatHold.
  const fromTickets =
    (resolvedOrder.tickets || []).find(
      (t: any) => String(t.ticketId) === String(ticketId)
    ) || null;

  let seat: any = null;
  if (fromTickets) {
    seat = {
      zoneId: fromTickets.zoneId,
      tableId: fromTickets.tableId,
      seatId: fromTickets.seatId,
    };
  } else {
    const sh = await SeatHold.findById(ticketId).lean();
    if (sh) {
      seat = {
        zoneId: sh.zoneId ?? sh.zone,
        tableId: sh.tableId ?? sh.table,
        seatId: sh.seatId ?? sh.seat,
      };
    }
  }

  return { order: resolvedOrder, seat };
}

/** POST /api/whatsapp/send-tickets
 * body: { phone: string, ticketIds: string[], introMessage?: string }
 */
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

    const ids: string[] = ticketIds || [];

    // Mensaje introductorio opcional (no bloquea)
    if (introMessage) {
      try {
        await sendWhatsAppText(phone, introMessage);
      } catch (e) {
        console.warn("⚠️ No se pudo enviar introMessage:", (e as any)?.message);
      }
    }

    const results: any[] = [];

    for (const tid of ids) {
      try {
        // 1) Garantiza que el PDF exista (si ya existe, ensureTicketPdf no regenera).
        //    Para generarlo necesitamos {order, seat}. Si no existen, igual hacemos fallback por link.
        let orderForPdf: any = null;
        let seatForPdf: any = null;

        try {
          const { order, seat } = await resolveOrderAndSeatForTicket(tid);
          orderForPdf = order;
          seatForPdf = seat;

          if (orderForPdf && seatForPdf) {
            await ensureTicketPdf({ ticketId: tid, order: orderForPdf, seat: seatForPdf });
          }
        } catch (e) {
          console.warn(`⚠️ No se pudo garantizar PDF para ${tid}:`, (e as any)?.message);
        }

        // 2) Intento preferido: ENVIAR ARCHIVO local por media_id
        const filePath = ticketFilePath(tid);
        const filename = ticketFileName(tid);
        const caption  = `Aquí está tu boleto (${tid}). ¡Gracias por tu compra!`;

        try {
          // Envía el archivo adjunto real (sube a /media y manda document.id)
          const resp = await sendWhatsAppDocumentFromFile(
            phone,
            filePath,
            filename,
            caption,
            "application/pdf"
          );
          results.push({ tid, mode: "file", ok: true, resp });
          continue; // siguiente ticket
        } catch (fileErr: any) {
          console.warn(`⚠️ Falló envío por archivo (${tid}). Fallback a link. Motivo:`, fileErr?.message);
        }

        // 3) Fallback: Enviar LINK
        const pdfUrl = buildTicketPdfUrl(req, tid);
        const resp2 = await sendWhatsAppDocument(phone, pdfUrl, filename, caption);
        results.push({ tid, mode: "link", ok: true, resp: resp2 });
      } catch (err: any) {
        console.error("❌ Error con ticket:", tid, err?.message || err);
        results.push({ tid, ok: false, error: err?.message || "error" });
      }
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
