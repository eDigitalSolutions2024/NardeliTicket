// src/services/whatsapp.ts
import axios from "axios";

const WA_API = (phoneNumberId: string) =>
  `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

const token = process.env.WHATSAPP_TOKEN as string;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID as string;

if (!token) {
  console.warn("⚠️ WHATSAPP_TOKEN no definido en .env");
}
if (!phoneNumberId) {
  console.warn("⚠️ WHATSAPP_PHONE_NUMBER_ID no definido en .env");
}

function toE164(raw: string): string {
  // Limpia y asume MX si viene a 10 dígitos; ajusta a tu realidad
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `52${digits}`; // MX
  return digits.startsWith("52") ? digits : digits; // ya viene con país
}

export async function sendWhatsAppText(to: string, body: string) {
  const toNum = toE164(to);
  if (!toNum) throw new Error("Número destino inválido");

  const payload = {
    messaging_product: "whatsapp",
    to: toNum,
    type: "text",
    text: { body },
  };

  const { data } = await axios.post(WA_API(phoneNumberId), payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
  return data;
}

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
      link, // URL público al PDF
      filename: filename || "boleto.pdf",
      caption: caption || "",
    },
  };

  const { data } = await axios.post(WA_API(phoneNumberId), payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
  });
  return data;
}
