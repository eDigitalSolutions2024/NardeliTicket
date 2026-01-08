// utils/tickets.ts
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import { PDFDocument as PdfLibDocument } from "pdf-lib"; // 👈 para unir PDFs

export function ticketsDir() {
  return path.join(__dirname, "..", "tickets");
}
export function ensureTicketsDir() {
  const dir = ticketsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function ticketFileName(ticketId: string) {
  return `ticket_${ticketId}.pdf`;
}
export function ticketFilePath(ticketId: string) {
  return path.join(ticketsDir(), ticketFileName(ticketId));
}

// ---- merged por orden ----
export function mergedTicketFileName(orderId: string) {
  return `tickets_order_${orderId}.pdf`;
}
export function mergedTicketFilePath(orderId: string) {
  return path.join(ticketsDir(), mergedTicketFileName(orderId));
}

// ---------- Helpers ----------
function fmtDate(d?: any) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(d);
  }
}
function money(n?: number) {
  if (typeof n !== "number" || !isFinite(n)) return "-";
  return `$${n.toFixed(2)} MXN`;
}

// ---------- PDF de UN boleto ----------
export async function ensureTicketPdf({
  ticketId,
  order,
  seat,
}: {
  ticketId: string;
  order: any;
  seat: any;
}): Promise<string> {
  ensureTicketsDir();
  const file = ticketFilePath(ticketId);
  if (fs.existsSync(file)) return file;

  const NAVY = "#0c3c73";
  const GRAY = "#6b7280";
  const BORDER = "#e5e7eb";

  const eventName =
    order?.eventName || order?.event?.title || order?.event?.name || "Evento";
  const eventDate = order?.eventDate || order?.event?.date || order?.date;
  const eventPlace =
    order?.eventPlace || order?.event?.location || order?.event?.lugar || "";

  const zona = seat?.zoneId || seat?.zone || seat?.section || "-";
  const mesa = seat?.tableId || seat?.table || seat?.row || "-";
  const asiento = seat?.seatId || seat?.seat || "-";
  const precio =
    typeof seat?.price === "number"
      ? seat.price
      : typeof order?.price === "number"
      ? order.price
      : undefined;

  const logoPathFromEnv = process.env.LOGO_PATH;
  const defaultLogoPath = path.join(__dirname, "logo-nardeli.png");
  const logoPath = fs.existsSync(logoPathFromEnv || "")
    ? (logoPathFromEnv as string)
    : fs.existsSync(defaultLogoPath)
    ? defaultLogoPath
    : null;

  const base = process.env.PUBLIC_URL ?? "http://localhost:5173";
  const qrText = `${base}/tickets/verify?tid=${ticketId}&oid=${order?._id ?? ""}`;
  const qrBuf = await QRCode.toBuffer(qrText, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
  });

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A6", margin: 18 });
    const out = fs.createWriteStream(file);
    doc.pipe(out);

    // Header
    const headerH = 42;
    doc
      .roundedRect(18, 18, doc.page.width - 36, headerH, 8)
      .fillOpacity(0.06)
      .fill(NAVY)
      .fillOpacity(1);

    let logoW = 0;
    try {
      if (logoPath) {
        const targetH = 28;
        doc.image(logoPath, 26, 25, { height: targetH });
        logoW = targetH * 2;
      }
    } catch {}

    doc
      .fillColor(NAVY)
      .fontSize(16)
      .text("NardeliTicket", 26 + (logoW ? logoW + 6 : 0), 26, {
        width: doc.page.width - 26 * 2 - (logoW ? logoW + 6 : 0),
        align: "left",
      });

    doc
      .fillColor(GRAY)
      .fontSize(10)
      .text(`Folio: #${order?._id || "—"}`, 26 + (logoW ? logoW + 6 : 0), 26 + 18);

    // Tarjeta
    const cardY = 18 + headerH + 10;
    const cardX = 18;
    const cardW = doc.page.width - 36;
    const cardH = 190; // un poquito más alto para texto
    doc
      .roundedRect(cardX, cardY, cardW, cardH, 10)
      .lineWidth(1.2)
      .strokeColor(BORDER)
      .stroke();

    // Título del evento
    doc
      .fillColor("#111827")
      .fontSize(14)
      .text(eventName, cardX + 12, cardY + 10, {
        width: cardW - 24,
        align: "left",
      });

    // Separador
    doc
      .moveTo(cardX + 12, cardY + 34)
      .lineTo(cardX + cardW - 12, cardY + 34)
      .lineWidth(1)
      .strokeColor(BORDER)
      .stroke();

    // --- Layout de columnas dinámicas ---
    const leftX = cardX + 12;
    const rightX = cardX + cardW / 2;
    const colWidth = (cardW - 24) / 2 - 4; // ancho de cada columna
    let y = cardY + 44;

    // Dibuja un label + valor y devuelve la altura usada
    function drawField(
      label: string,
      value: string | undefined,
      x: number,
      yPos: number
    ) {
      const txt = value || "-";

      // Label
      doc.fillColor(GRAY).fontSize(9).text(label, x, yPos, {
        width: colWidth,
      });
      const labelH = doc.heightOfString(label, { width: colWidth });

      // Valor
      doc
        .fillColor("#111827")
        .fontSize(11)
        .text(txt, x, yPos + labelH + 1, {
          width: colWidth,
        });
      const valueH = doc.heightOfString(txt, { width: colWidth });

      return labelH + 1 + valueH;
    }

    // Dibuja una fila de hasta 2 columnas y aumenta "y"
    function twoColsRow(
      labelLeft: string,
      valueLeft: string | undefined,
      labelRight?: string,
      valueRight?: string
    ) {
      const hLeft = drawField(labelLeft, valueLeft, leftX, y);
      let hRight = 0;

      if (labelRight) {
        hRight = drawField(labelRight, valueRight, rightX, y);
      }

      y += Math.max(hLeft, hRight) + 8; // espacio entre filas
    }

    // ---- Filas de datos ----
    twoColsRow("Fecha", fmtDate(eventDate), "Lugar", eventPlace || "-");
    twoColsRow("Zona", String(zona), "Mesa", String(mesa));
    // Sin precio: solo mostramos asiento en la tercera fila
    twoColsRow("Asiento", String(asiento));

    // Texto inferior de la tarjeta
    doc
      .fillColor(GRAY)
      .fontSize(9)
      .text("Presenta este boleto en el acceso.", cardX + 12, cardY + cardH - 18, {
        width: cardW - 24,
        align: "left",
      });

    // QR
    const qrSize = 120;
    const qrY = cardY + cardH + 18;
    const qrX = (doc.page.width - qrSize) / 2;
    doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .fillColor(GRAY)
      .fontSize(9)

    // Footer
    doc
      .fillColor(GRAY)
      .fontSize(9)

    doc.end();
    out.on("finish", resolve);
    out.on("error", reject);
  });

  return file;
}

// ---------- PDF combinado por orden ----------
export async function ensureMergedTicketsPdf(
  orderId: string,
  ticketIds: string[]
): Promise<string> {
  ensureTicketsDir();
  const outPath = mergedTicketFilePath(orderId);
  //if (fs.existsSync(outPath)) return outPath;

  const mergedPdf = await PdfLibDocument.create();

  for (const tid of ticketIds) {
    const p = ticketFilePath(tid);
    if (!fs.existsSync(p)) continue;

    try {
      const bytes = fs.readFileSync(p);
      const src = await PdfLibDocument.load(bytes);  // 👈 aquí reventaba
      const pages = await mergedPdf.copyPages(src, src.getPageIndices());
      pages.forEach((pg) => mergedPdf.addPage(pg));
    } catch (err) {
      console.error("⚠️ PDF individual inválido, se omite:", p, err);
      // Si quieres, puedes borrar el archivo dañado:
      // try { fs.unlinkSync(p); } catch {}
      continue;
    }
  }

  const outBytes = await mergedPdf.save();
  fs.writeFileSync(outPath, outBytes);
  return outPath;
}

