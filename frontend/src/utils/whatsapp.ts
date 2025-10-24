// arma el texto y abre WhatsApp
export function openWhatsAppShare(params: {
  eventTitle: string;
  whenText: string;      // ej: "31 oct 2025, 8:52 p.m."
  orderUrl: string;      // link seguro a la orden (o a "Mis tickets")
  ticketUrls?: string[]; // links por ticket (opcional)
}) {
  const { eventTitle, whenText, orderUrl, ticketUrls = [] } = params;

  const lines: string[] = [
    `🎟️ *Entradas* — ${eventTitle}`,
    `🗓️ ${whenText}`,
    "",
    `🔗 Ver/descargar tus boletos:`,
    orderUrl,
  ];

  if (ticketUrls.length) {
    lines.push("", "Tickets individuales:");
    ticketUrls.forEach((u, i) => lines.push(`• Ticket ${i + 1}: ${u}`));
  }

  const text = lines.join("\n");
  const encoded = encodeURIComponent(text);

  // móvil: wa.me; desktop fallback: api.whatsapp.com
  const waUrl = isMobile()
    ? `https://wa.me/?text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;

  window.open(waUrl, "_blank", "noopener,noreferrer");
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
