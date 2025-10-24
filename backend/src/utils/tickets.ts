import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

export function ticketsDir() {
  // carpeta donde se guardan físicamente los PDFs
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

// Genera y guarda el PDF en disco (si ya existe, no regenera)
export async function ensureTicketPdf({
  ticketId,
  order,
  seat,
}: {
  ticketId: string;
  order: any;
  seat: any; // adapta a tu interfaz
}): Promise<string> {
  ensureTicketsDir();
  const file = ticketFilePath(ticketId);
  if (fs.existsSync(file)) return file;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A6", margin: 18 });
    const out = fs.createWriteStream(file);
    doc.pipe(out);

    // --- Ejemplo de contenido mínimo. Personalízalo. ---
    doc.fontSize(16).text("Nardeli Tickets", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Orden: ${order._id}`, { align: "left" });
    if (order.eventName) doc.text(`Evento: ${order.eventName}`);
    if (order.customerName) doc.text(`Cliente: ${order.customerName}`);
    if (order.eventDate) {
      doc.text(`Fecha: ${new Date(order.eventDate).toLocaleString("es-MX")}`);
    }
    if (seat) {
      doc.text(
        `Asiento: ${seat.section ?? "Sec"}-${seat.row ?? "Fila"}-${seat.seat ?? "Asiento"}`
      );
      if (seat.price) doc.text(`Precio: $${Number(seat.price).toFixed(2)}`);
    }
    doc.moveDown();
    doc.text("Gracias por tu compra.", { align: "center" });

    doc.end();
    out.on("finish", resolve);
    out.on("error", reject);
  });

  return file;
}
