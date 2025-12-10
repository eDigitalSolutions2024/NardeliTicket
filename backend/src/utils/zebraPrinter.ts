// backend/src/utils/zebraPrinter.ts
import { writeFileSync, unlinkSync } from "fs";
import { exec } from "child_process";
import path from "path";

// Nombre EXACTO de tu impresora
const PRINTER_NAME = "ZDesigner GC420t";

// El .ps1 está en backend/raw-print.ps1
// Compilado, __dirname ≈ backend/dist/utils
const PS_SCRIPT = path.join(__dirname, "../../raw-print.ps1");

// Campos que queremos reflejar parecidos al PDF
export interface NardeliTicketPayload {
  eventName: string;        // "ballet"
  dateLabel: string;        // "12 dic 2025, 2:56 p. m."
  eventPlace?: string;      // "Av. Waterfill 431, ..."
  orderFolio: string;       // order._id
  zone: string;             // "ORO"
  tableLabel: string;       // "Mesa 08" ó "M08"
  seatLabels: string[];     // ["A1","A2"] (puede ser 1 o varios)
  buyerName: string;        // "julian"
  priceLabel?: string;      // "$1,500.00 MXN" (total o por asiento)
  ticketCode: string;       // mismo que usarás en el código de barras
}

export function buildNardeliTicketEPL(p: NardeliTicketPayload): string {
  const {
    eventName,
    dateLabel,
    eventPlace,
    orderFolio,
    zone,
    tableLabel,
    seatLabels,
    buyerName,
    priceLabel,
    ticketCode,
  } = p;

  const seatsText = seatLabels.join(", ");

  // EPL: coordenadas en "dots". GC420t = 203 dpi. Vamos a usar 600x400 aprox.
  const lines: string[] = [
    "N",
    "q600",       // ancho
    "Q400,24",    // alto, gap

    // ----- Header estilo barra azul del PDF (aquí solo texto y línea) -----
    // Título
    'A20,20,0,4,1,1,N,"NardeliTicket"',
    // Folio
    `A20,60,0,2,1,1,N,"Folio: #${orderFolio}"`,

    // Línea horizontal (simulando el borde inferior del header)
    "LO20,90,560,2", // x,y,width,height
    "LW2",           // grosor
    "LE",

    // ----- Nombre del evento -----
    `A20,110,0,3,1,1,N,"${eventName.substring(0, 32)}"`,

    // Otra rayita
    "LO20,145,560,1",
    "LW1",
    "LE",
  ];

  // Helper para filas tipo "Fecha: valor"
  const addRow = (y: number, label: string, value: string) => {
    lines.push(
      `A20,${y},0,2,1,1,N,"${label}:"`,
      `A190,${y},0,2,1,1,N,"${(value || "-").substring(0, 32)}"`
    );
  };

  let y = 165;
  addRow(y, "Fecha", dateLabel);
  y += 30;
  addRow(y, "Lugar", eventPlace || "-");
  y += 30;
  addRow(y, "Zona", zone);
  y += 30;
  addRow(y, "Mesa", tableLabel || "-");
  y += 30;
  addRow(y, "Asiento(s)", seatsText || "-");
  y += 30;
  if (priceLabel) {
    addRow(y, "Precio", priceLabel);
    y += 30;
  }
  if (buyerName) {
    addRow(y, "Cliente", buyerName);
    y += 30;
  }

  // Separador antes del código de barras
  lines.push("LO20," + (y + 10) + ",560,1", "LW1", "LE");

  // Código de barras Code39 con ticketCode
  // Bx,y,rot,barcode,narrow,wide,height,HR,data
  lines.push(`B60,${y + 25},0,1,2,6,80,B,"${ticketCode}"`);

  // Texto pequeño abajo
  lines.push(
    `A20,${y + 120},0,1,1,1,N,"Presenta este boleto en el acceso."`,
    `A20,${y + 140},0,1,1,1,N,"Ticket: ${ticketCode}"`
  );

  lines.push("P1");
  return lines.join("\r\n");
}


export function sendEPLToZebra(epl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(__dirname, `ticket_${Date.now()}.txt`);
    writeFileSync(tmpFile, epl, "ascii");

    const cmd = [
      "powershell",
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", `"${PS_SCRIPT}"`,
      "-PrinterName", `"${PRINTER_NAME}"`,
      "-FilePath", `"${tmpFile}"`
    ].join(" ");

    exec(cmd, (err, stdout, stderr) => {
      try { unlinkSync(tmpFile); } catch (_) {}

      console.log("[ZEBRA OUT]:", stdout);
      if (err) {
        console.error("[ZEBRA ERR]:", stderr);
        return reject(err);
      }
      resolve();
    });
  });
}

export async function printNardeliTicket(order: NardeliTicketPayload): Promise<void> {
  const epl = buildNardeliTicketEPL(order);
  await sendEPLToZebra(epl);
}
