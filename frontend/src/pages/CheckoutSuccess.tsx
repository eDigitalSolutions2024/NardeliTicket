// src/pages/CheckoutSuccess.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { API_BASE, api } from "../api/client";

type LocationState = {
  orderId?: string;
  reservaId?: string;
  ticketIds?: string[];
  phone?: string;
};

function sanitizePhone(input: string): string {
  return (input || "").replace(/\D/g, "");
}

function buildWaUrl(message: string, phone?: string): string {
  const encoded = encodeURIComponent(message);
  const to = sanitizePhone(phone || "");
  return to ? `https://wa.me/${to}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

// 🔗 PDF por boleto: http://localhost:4000/api/tickets/<ticketId>.pdf
function buildTicketPdfUrl(tid: string): string {
  return `${API_BASE}/checkout/tickets/${tid}.pdf`;
}

export default function CheckoutSuccess(): JSX.Element {
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const [searchParams] = useSearchParams();

  // orderId y/o ticketIds pueden venir por state o query (?orderId=..., ?ticketId=... o ?ticketIds=a,b,c)
  const orderId =
    state.orderId ||
    state.reservaId ||
    searchParams.get("orderId") ||
    searchParams.get("order") ||
    searchParams.get("reservaId") ||
    undefined;

  const ticketIdsFromQuery = (() => {
    const one = searchParams.get("ticketId");
    const many = searchParams.get("ticketIds"); // coma-separados
    if (one) return [one];
    if (many) return many.split(",").map((s) => s.trim()).filter(Boolean);
    return undefined;
  })();

  const [ticketIds, setTicketIds] = useState<string[] | undefined>(
    state.ticketIds || ticketIdsFromQuery
  );

  const [phone, setPhone] = useState<string>(sanitizePhone(state.phone || searchParams.get("phone") || ""));

  // Fallback opcional: si tenemos orderId pero no ticketIds, intenta pedirlos al backend.
  useEffect(() => {
    let cancelled = false;
    async function fetchTicketIds() {
      if (!orderId || (ticketIds && ticketIds.length)) return;
      try {
        // Espera que el backend exponga: GET /api/orders/:orderId/tickets -> string[]
        const { data } = await api.get<string[]>(`/api/checkout/orders/${orderId}/tickets`);
        if (!cancelled && Array.isArray(data) && data.length) setTicketIds(data);
      } catch {
        // Silencioso: si no existe el endpoint aún, seguimos sin bloquear la vista
      }
    }
    fetchTicketIds();
    return () => {
      cancelled = true;
    };
  }, [orderId, ticketIds]);

  const pdfUrls = useMemo<string[]>(() => {
    return (ticketIds || []).map(buildTicketPdfUrl);
  }, [ticketIds]);

  const messageText = useMemo<string>(() => {
    const header = `¡Hola! Aquí están tus boletos de NardeliTicket 🎟️`;
    const folio = orderId ? `\nFolio / Orden: #${orderId}` : "";
    const links =
      pdfUrls.length > 0
        ? `\n\nEnlaces de boletos (PDF):\n${pdfUrls.join("\n")}`
        : "";
    const footer = `\n\n¡Gracias por tu compra!`;
    return `${header}${folio}${links}${footer}`;
  }, [orderId, pdfUrls]);

  const handleSendWhatsApp = (): void => {
    const url = buildWaUrl(messageText, phone);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyLinks = async (): Promise<void> => {
    try {
      if (!pdfUrls.length) return;
      await navigator.clipboard.writeText(pdfUrls.join("\n"));
      alert("Link(s) copiado(s) al portapapeles ✅");
    } catch {
      alert("No se pudo copiar. Abre el PDF y copia desde ahí.");
    }
  };

  const handleOpenFirstPdf = (): void => {
    if (pdfUrls.length) window.open(pdfUrls[0], "_blank", "noopener,noreferrer");
  };

  const hasData = Boolean(orderId || (ticketIds && ticketIds.length));

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.icon}>✅</div>
        <h1 style={styles.title}>¡Pago confirmado!</h1>
        <p style={styles.subtitle}>
          Tu compra se realizó con éxito. {orderId ? `Folio: #${orderId}` : ""}
        </p>

        {!hasData && (
          <div style={styles.alert}>
            No se recibieron <b>ticketIds</b> ni <b>orderId</b>. Regresa al inicio o intenta nuevamente.
          </div>
        )}

        <div style={styles.section}>
          <label style={styles.label}>Enviar por WhatsApp a:</label>
          <div style={styles.row}>
            <span style={styles.prefix}>+</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(sanitizePhone(e.target.value))}
              placeholder="521XXXXXXXXXX"
              style={styles.input}
              aria-label="Número con lada"
            />
          </div>
          <small style={styles.hint}>
            Ingresa el número con lada (ej. México: 52). Se enviará un mensaje con los enlaces directos a los PDF.
          </small>
        </div>

        <div style={styles.actions}>
          <button onClick={handleSendWhatsApp} style={styles.primaryBtn} disabled={!pdfUrls.length && !orderId}>
            Enviar boletos por WhatsApp
          </button>
          <button onClick={handleOpenFirstPdf} style={styles.secondaryBtn} disabled={!pdfUrls.length}>
            Abrir primer PDF
          </button>
          <button onClick={handleCopyLinks} style={styles.secondaryBtn} disabled={!pdfUrls.length}>
            Copiar links
          </button>
        </div>

        {!!pdfUrls.length && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Boletos generados:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {pdfUrls.map((u) => (
                <li key={u} style={{ wordBreak: "break-all" }}>
                  <a href={u} target="_blank" rel="noreferrer">{u}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={styles.footerBox}>
          <p style={styles.footerText}>
            Si no te llega el mensaje, puedes copiar los enlaces o abrir el PDF directamente.
          </p>
          <Link to="/" style={styles.linkHome}>Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f7f8",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,.08)",
  },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { margin: 0, fontSize: 24, fontWeight: 700 },
  subtitle: { marginTop: 8, color: "#555", lineHeight: 1.4 },
  section: { marginTop: 20 },
  label: { display: "block", marginBottom: 8, fontWeight: 600 },
  row: { display: "flex", alignItems: "center", gap: 8 },
  prefix: {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fafafa",
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    outline: "none",
  },
  hint: { display: "block", marginTop: 6, color: "#777", fontSize: 12 },
  actions: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  primaryBtn: {
    gridColumn: "1 / -1",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#16a34a",
    color: "#fff",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#f3f4f6",
    color: "#111827",
    fontWeight: 600,
    border: "1px solid #e5e7eb",
    cursor: "pointer",
  },
  footerBox: { marginTop: 18, textAlign: "center" },
  footerText: { color: "#6b7280", marginBottom: 8 },
  alert: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    padding: "10px 12px",
    borderRadius: 10,
    marginTop: 12,
  },
  linkHome: { textDecoration: "none", color: "#2563eb", fontWeight: 600 },
};
