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




function tableIdToLabel(tableId?: string): string | null {
  if (!tableId) return null;

  // VIP-3 -> VIP-C
  // ORO-1 -> ORO-A
  const m = String(tableId).match(/^([A-Z]+)[-_](\d+)$/i);
  if (!m) return String(tableId);

  const zone = m[1].toUpperCase();
  const n = parseInt(m[2], 10);
  if (!Number.isFinite(n) || n <= 0) return String(tableId);

  // 1->A, 2->B, 3->C ...
  const letter = String.fromCharCode(64 + n); // 65 = 'A'
  return `${zone}-${letter}`;
}

function seatIdToLabel(seatId?: string): string | null {
  if (!seatId) return null;

  // seatId puede venir como "S21" o "21"
  const m = String(seatId).match(/(\d+)/);
  if (!m) return String(seatId);

  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return String(seatId);

  // Convierte a 1..8 (siempre 8 asientos por mesa)
  const seatIndex = ((n - 1) % 8) + 1;
  return `C${seatIndex}`; // 👈 si prefieres "1" cambia a String(seatIndex)
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

  const eventName =
    order?.eventName || order?.event?.title || order?.event?.name || "Evento";
  const eventDate = order?.eventDate || order?.event?.date || order?.date;
  const eventPlace =
    order?.eventPlace || order?.event?.location || order?.event?.lugar || "";

  // ¿Es admisión general? (sin silla ni mesa)
  const isGeneral =
    seat?.general === true ||
    String(seat?.zoneId ?? "").toUpperCase() === "GENERAL";
  const ticketNumber: number | undefined = seat?.ticketNumber;
  const ticketTotal: number | undefined = seat?.ticketTotal;

  const zona = seat?.zoneId || seat?.zone || seat?.section || "-";
  const mesaRaw =
  seat?.tableLabel ||
  seat?.tableName ||
  seat?.tableId ||
  seat?.table ||
  seat?.row ||
  "";

const mesa = mesaRaw ? (tableIdToLabel(mesaRaw) ?? String(mesaRaw)) : "-";



const asiento =
  seat?.seatLabel
    ? String(seat.seatLabel)   // ✅ F7
    : seat?.seatId
    ? String(seat.seatId)      // fallback S57
    : "-";



  const precio =
    typeof seat?.price === "number"
      ? seat.price
      : typeof order?.price === "number"
      ? order.price
      : undefined;

  const logoPathFromEnv = process.env.LOGO_PATH;
  const defaultLogoPath = path.join(__dirname, "nardeli-mark-white.png");
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

  // Paleta de marca (morado)
  const PURPLE1 = "#6d28d9";
  const PURPLE2 = "#a855f7";
  const INK = "#1a1229";
  const MUTED = "#6b6880";
  const PAGEBG = "#efeaf7";
  const LINE = "#ded4ef";

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: [330, 540], margin: 0 });
    const out = fs.createWriteStream(file);
    doc.pipe(out);

    const W = doc.page.width;
    const H = doc.page.height;

    // Fondo
    doc.rect(0, 0, W, H).fill(PAGEBG);

    // Tarjeta
    const pad = 16;
    const cardX = pad;
    const cardY = pad;
    const cardW = W - pad * 2;
    const cardH = H - pad * 2;
    const R = 20;
    doc.roundedRect(cardX, cardY, cardW, cardH, R).fill("#ffffff");

    // --- Encabezado con gradiente (esquinas superiores redondeadas) ---
    const headerH = 96;
    doc.save();
    doc.roundedRect(cardX, cardY, cardW, headerH + R, R).clip();
    const grad = doc.linearGradient(cardX, cardY, cardX + cardW, cardY + headerH);
    grad.stop(0, PURPLE1).stop(1, PURPLE2);
    doc.rect(cardX, cardY, cardW, headerH).fill(grad);
    doc.restore();

    // Logo + marca
    let brandX = cardX + 20;
    try {
      if (logoPath) {
        doc.image(logoPath, cardX + 20, cardY + 26, { height: 44 });
        brandX = cardX + 20 + 54;
      }
    } catch {}
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(19)
      .text("NardeliTicket", brandX, cardY + 30);
    doc
      .fillColor("#ecdcff")
      .font("Helvetica")
      .fontSize(8)
      .text("BOLETO DE ACCESO", brandX, cardY + 55, { characterSpacing: 2 });

    // --- Título del evento ---
    let y = cardY + headerH + 20;
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(17)
      .text(eventName, cardX + 20, y, { width: cardW - 40 });
    y += doc.heightOfString(eventName, { width: cardW - 40 }) + 12;

    // Línea de acento
    doc.rect(cardX + 20, y, 48, 3).fill(PURPLE2);
    y += 18;

    // --- Campos ---
    const leftX = cardX + 20;
    const rightX = cardX + cardW / 2 + 6;
    const colWidth = (cardW - 40) / 2 - 8;

    function drawField(label: string, value: string | undefined, x: number, yPos: number) {
      const txt = value || "-";
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(8)
        .text(label.toUpperCase(), x, yPos, { width: colWidth, characterSpacing: 1 });
      const labelH = doc.heightOfString(label.toUpperCase(), { width: colWidth, characterSpacing: 1 });
      doc
        .fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(txt, x, yPos + labelH + 2, { width: colWidth });
      const valueH = doc.heightOfString(txt, { width: colWidth });
      return labelH + 2 + valueH;
    }

    function twoColsRow(l1: string, v1: string | undefined, l2?: string, v2?: string) {
      const h1 = drawField(l1, v1, leftX, y);
      let h2 = 0;
      if (l2) h2 = drawField(l2, v2, rightX, y);
      y += Math.max(h1, h2) + 12;
    }

    twoColsRow("Fecha", fmtDate(eventDate), "Lugar", eventPlace || "-");
    if (isGeneral) {
      const boletoStr =
        ticketNumber && ticketTotal ? `Boleto ${ticketNumber} de ${ticketTotal}` : "—";
      twoColsRow("Tipo de acceso", "Admisión general", "Boleto", boletoStr);
      if (typeof precio === "number") twoColsRow("Precio", money(precio));
    } else {
      twoColsRow("Zona", String(zona), "Mesa", String(mesa));
      twoColsRow("Asiento", String(asiento), typeof precio === "number" ? "Precio" : undefined, typeof precio === "number" ? money(precio) : undefined);
    }

    // --- Perforación (estilo stub) ---
    const perfY = cardY + cardH - 216;
    doc.circle(cardX, perfY, 9).fill(PAGEBG);
    doc.circle(cardX + cardW, perfY, 9).fill(PAGEBG);
    doc
      .save()
      .moveTo(cardX + 14, perfY)
      .lineTo(cardX + cardW - 14, perfY)
      .lineWidth(1.5)
      .dash(4, { space: 4 })
      .strokeColor(LINE)
      .stroke()
      .undash()
      .restore();

    // --- Stub: folio + QR ---
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text("FOLIO", cardX + 20, perfY + 16, { characterSpacing: 2 });
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`#${order?._id || "—"}`, cardX + 20, perfY + 28, { width: cardW - 40 });

    const qrSize = 132;
    const qrX = cardX + (cardW - qrSize) / 2;
    const qrY = perfY + 50;
    doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8.5)
      .text("Escanea el código o presenta este boleto en el acceso.", cardX + 20, qrY + qrSize + 10, {
        width: cardW - 40,
        align: "center",
      });

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

