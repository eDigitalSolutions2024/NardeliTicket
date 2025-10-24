import React from "react";
import { openWhatsAppShare } from "../utils/whatsapp";

type Props = {
  eventTitle: string;
  whenText: string;        // ej: new Date(date).toLocaleString("es-MX", {...})
  orderUrl: string;        // ruta a tu página de orden/tickets
  ticketUrls?: string[];   // opcional
  label?: string;          // texto del botón
  fullWidth?: boolean;
};

export default function WhatsAppShareButton({
  eventTitle,
  whenText,
  orderUrl,
  ticketUrls,
  label = "Enviar por WhatsApp",
  fullWidth,
}: Props) {
  return (
    <button
      onClick={() => openWhatsAppShare({ eventTitle, whenText, orderUrl, ticketUrls })}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #22c55e",
        background: "#10b981",
        color: "white",
        fontWeight: 700,
        cursor: "pointer",
        width: fullWidth ? "100%" : undefined,
      }}
    >
      {/* ícono simple */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path fill="white" d="M20.52 3.48A11.86 11.86 0 0 0 12.06.01a12 12 0 0 0-10.6 17.38L.01 24l6.77-1.41A12 12 0 0 0 12 24h.01a12 12 0 0 0 8.51-20.52ZM12 21.82h-.01a9.75 9.75 0 0 1-4.97-1.36l-.36-.21-4.02.83.84-3.91-.24-.4a9.76 9.76 0 1 1 8.76 5.05Zm5.47-7.32c-.3-.15-1.78-.88-2.06-.98-.28-.1-.49-.15-.7.15-.21.3-.81.98-.99 1.18-.18.2-.36.22-.66.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.47-1.74-1.65-2.03-.18-.3-.02-.46.13-.61.13-.13.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.7-1.68-.96-2.3-.25-.6-.5-.52-.7-.53l-.6-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.1 4.48.71.31 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.08 1.78-.72 2.03-1.41.25-.69.25-1.28.18-1.41-.07-.13-.25-.2-.55-.35Z"/>
      </svg>
      {label}
    </button>
  );
}
