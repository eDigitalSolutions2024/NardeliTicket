// utils/tickets.ts
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode"; // 👈 NUEVO

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
  const defaultLogoPath = path.join(__dirname, "logo-nardeli.png"); // evita acentos
  const logoPath = fs.existsSync(logoPathFromEnv || "")
    ? (logoPathFromEnv as string)
    : fs.existsSync(defaultLogoPath)
    ? defaultLogoPath
    : null;

  // 👇 Preparamos un texto/URL “dummy” para el QR (luego lo cambiamos)
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

    // ====== Header (logo + marca) ======
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

    // ====== Tarjeta de detalles ======
    const cardY = 18 + headerH + 10;
    const cardX = 18;
    const cardW = doc.page.width - 36;
    const cardH = 180;

    doc
      .roundedRect(cardX, cardY, cardW, cardH, 10)
      .lineWidth(1.2)
      .strokeColor(BORDER)
      .stroke();

    doc
      .fillColor("#111827")
      .fontSize(14)
      .text(eventName, cardX + 12, cardY + 10, { width: cardW - 24, align: "left" });

    doc
      .moveTo(cardX + 12, cardY + 34)
      .lineTo(cardX + cardW - 12, cardY + 34)
      .lineWidth(1)
      .strokeColor(BORDER)
      .stroke();

    const leftX = cardX + 12;
    const rightX = cardX + cardW / 2;
    let y = cardY + 44;

    const row = (label: string, value: string, x: number) => {
      doc.fillColor(GRAY).fontSize(9).text(label, x, y);
      doc.fillColor("#111827").fontSize(11).text(value || "-", x, y + 12);
    };

    row("Fecha", fmtDate(eventDate), leftX);
    row("Lugar", eventPlace || "-", rightX);

    y += 36;
    row("Zona", String(zona), leftX);
    row("Mesa", String(mesa), rightX);

    y += 36;
    row("Asiento", String(asiento), leftX);
    row("Precio", money(typeof precio === "number" ? precio : undefined), rightX);

    doc
      .fillColor(GRAY)
      .fontSize(9)
      .text("Presenta este boleto en el acceso.", cardX + 12, cardY + cardH - 18);

    // ====== QR centrado debajo del ticket ======
    const qrSize = 120; // px aprox
    const qrY = cardY + cardH + 14;
    const qrX = (doc.page.width - qrSize) / 2;
    doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });

    // leyenda opcional
    doc
      .fillColor(GRAY)
      .fontSize(9)
      .text("Escanea este QR (próximamente).", 18, qrY + qrSize + 6, {
        width: doc.page.width - 36,
        align: "center",
      });

    // ====== Footer ======
    doc
      .fillColor(GRAY)
      .fontSize(9)
      .text(`Ticket: ${ticketId}`, 18, doc.page.height - 24, {
        width: doc.page.width - 36,
        align: "center",
      });

    doc.end();
    out.on("finish", resolve);
    out.on("error", reject);
  });

  return file;
}
