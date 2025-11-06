// src/services/whatsapp.ts
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

const API_VERSION = "v20.0"; // manténlo alineado con tu proyecto

const token = process.env.WHATSAPP_TOKEN as string;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID as string;

if (!token) console.warn("⚠️ WHATSAPP_TOKEN no definido en .env");
if (!phoneNumberId) console.warn("⚠️ WHATSAPP_PHONE_NUMBER_ID no definido en .env");

const WA_MESSAGES = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
const WA_MEDIA    = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`;

function toE164(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `52${digits}`; // MX por defecto
  return digits;
}

/* =======================
   TEXT
======================= */
export async function sendWhatsAppText(to: string, body: string) {
  const toNum = toE164(to);
  if (!toNum) throw new Error("Número destino inválido");

  const payload = {
    messaging_product: "whatsapp",
    to: toNum,
    type: "text",
    text: { body },
  };

  const { data } = await axios.post(WA_MESSAGES, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
  return data;
}

/* =======================
   DOCUMENTO POR LINK (lo que ya tenías)
======================= */
export async function sendWhatsAppDocument(
  to: string,
  link: string,
  filename?: string,
  caption?: string
) {
  const toNum = toE164(to);
  if (!toNum) throw new Error("Número destino inválido");

  const payload = {
    messaging_product: "whatsapp",
    to: toNum,
    type: "document",
    document: {
      link,
      filename: filename || "boleto.pdf",
      caption: caption || "",
    },
  };

  const { data } = await axios.post(WA_MESSAGES, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
  });
  return data;
}

/* =======================
   NUEVO: SUBIR ARCHIVO → media_id
======================= */
export async function uploadMediaFile(
  filePath: string,
  mime: string = "application/pdf",
  customFilename?: string
) {
  if (!fs.existsSync(filePath)) throw new Error(`No existe el archivo: ${filePath}`);

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", fs.createReadStream(filePath), {
    contentType: mime,
    filename: customFilename || filePath.split(/[\\/]/).pop(),
  });

  const { data } = await axios.post(WA_MEDIA, form, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders(),
    },
    maxBodyLength: Infinity,
    timeout: 60000,
  });

  // data = { id: "<media_id>" }
  return data.id as string;
}

/* =======================
   NUEVO: ENVIAR DOCUMENTO POR media_id (adjunto real)
======================= */
export async function sendWhatsAppDocumentByMediaId(
  to: string,
  mediaId: string,
  filename?: string,
  caption?: string
) {
  const toNum = toE164(to);
  if (!toNum) throw new Error("Número destino inválido");

  const payload: any = {
    messaging_product: "whatsapp",
    to: toNum,
    type: "document",
    document: { id: mediaId },
  };
  if (filename) payload.document.filename = filename;
  if (caption)  payload.document.caption  = caption;

  const { data } = await axios.post(WA_MESSAGES, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: 30000,
  });
  return data;
}

/* =======================
   NUEVO: Helper de alto nivel
   (sube un archivo local y lo envía en un paso)
======================= */
export async function sendWhatsAppDocumentFromFile(
  to: string,
  filePath: string,
  filename?: string,
  caption?: string,
  mime: string = "application/pdf"
) {
  const mediaId = await uploadMediaFile(filePath, mime, filename);
  return sendWhatsAppDocumentByMediaId(to, mediaId, filename, caption);
}
