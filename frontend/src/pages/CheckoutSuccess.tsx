// src/pages/CheckoutSuccess.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
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
function isValidPhone(raw?: string): boolean {
  const d = sanitizePhone(raw || "");
  return d.length >= 10; // 10 sin lada (MX) o >=12 con lada
}
function normalizeE164Mx(raw: string): string {
  const d = sanitizePhone(raw);
  if (d.length === 10) return `52${d}`;
  return d;
}
function buildWaUrl(message: string, phone?: string): string {
  const encoded = encodeURIComponent(message);
  const to = sanitizePhone(phone || "");
  return to ? `https://wa.me/${to}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
function getPhoneFromStorage(): string | null {
  try {
    const raw = localStorage.getItem("NT_PENDING_CHECKOUT");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.buyer?.phone || obj?.phone || null;
  } catch {
    return null;
  }
}

// 🔗 PDF por boleto: http://localhost:4000/api/checkout/tickets/<ticketId>.pdf
function buildTicketPdfUrl(tid: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const hasApi = /\/api$/.test(base);
  const root = hasApi ? base : `${base}/api`;
  return `${root}/checkout/tickets/${tid}.pdf`;
}

export default function CheckoutSuccess() {
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const [searchParams] = useSearchParams();

  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [loadingGen, setLoadingGen] = useState(false);
  const [errorGen, setErrorGen] = useState<string | null>(null);

  // WhatsApp
  const [sendingWa, setSendingWa] = useState(false);
  const [sentOkWa, setSentOkWa] = useState<boolean | null>(null);
  const [sendErrWa, setSendErrWa] = useState<string | null>(null);
  const alreadySentRef = useRef(false);

  // orderId puede venir por state o query (?orderId=?)
  const orderId =
    state.orderId ||
    state.reservaId ||
    searchParams.get("orderId") ||
    searchParams.get("order") ||
    searchParams.get("reservaId") ||
    undefined;

  // ticketIds por query (?ticketIds=a,b,c) o (?ticketId=uno)
  const ticketIdsFromQuery = (() => {
    const one = searchParams.get("ticketId");
    const many = searchParams.get("ticketIds");
    if (one) return [one];
    if (many) return many.split(",").map((s) => s.trim()).filter(Boolean);
    return undefined;
  })();

  const [ticketIds, setTicketIds] = useState<string[] | undefined>(
    state.ticketIds || ticketIdsFromQuery
  );

  const [phone, setPhone] = useState<string>(() => {
    const fromState = sanitizePhone(state.phone || "");
    const fromQuery = sanitizePhone(searchParams.get("phone") || "");
    const fromStorage = sanitizePhone(getPhoneFromStorage() || "");
    return fromState || fromQuery || fromStorage || "";
  });

  // 1) Polling corto para esperar al webhook (si hay orderId y aún no hay ticketIds)
  useEffect(() => {
    let cancelled = false;
    if (!orderId || (ticketIds && ticketIds.length)) return;

    let attempts = 0;
    const POLL_LIMIT = 5;
    const POLL_MS = 1500;

    async function tryFetchTickets() {
      attempts++;
      try {
        const { data } = await api.get<string[]>(`/checkout/orders/${orderId}/tickets`);
        if (!cancelled && Array.isArray(data) && data.length) {
          setTicketIds(data);
          return; // listo, ya no seguir
        }
      } catch {
        // ignorar, reintenta
      }
      if (!cancelled && attempts < POLL_LIMIT) {
        setTimeout(tryFetchTickets, POLL_MS);
      }
    }

    tryFetchTickets();
    return () => { cancelled = true; };
  }, [orderId, ticketIds]);

  // 2) Si ya tengo ticketIds pero aún no tengo PDFs generados, intenta generarlos 1 vez
  const triedAutoGenRef = useRef(false);
  useEffect(() => {
    if (triedAutoGenRef.current) return;
    if (!orderId) return;
    if (!ticketIds || ticketIds.length === 0) return;
    if (generatedUrls.length > 0) return;

    triedAutoGenRef.current = true;
    (async () => {
      try {
        setLoadingGen(true);
        const { data } = await api.post(`/api/checkout/orders/${orderId}/tickets/generate`);
        const urls: string[] = Array.isArray(data?.files)
          ? data.files.map((f: any) => f.url).filter(Boolean)
          : [];
        const ids: string[] = Array.isArray(data?.files)
          ? data.files.map((f: any) => f.ticketId).filter(Boolean)
          : [];
        if (urls.length) setGeneratedUrls(urls);
        if (ids.length) setTicketIds(ids);
      } catch (e: any) {
        // no bloquear la vista; el usuario puede usar el botón "Generar PDFs"
      } finally {
        setLoadingGen(false);
      }
    })();
  }, [orderId, ticketIds, generatedUrls.length]);

  // 3) Envío automático por WhatsApp SOLO cuando hay phone y (ticketIds o pdfUrls)
  useEffect(() => {
    if (alreadySentRef.current) return;
    const ok =
      !!sanitizePhone(phone || "") &&
      ( (ticketIds?.length || 0) > 0 || (generatedUrls.length > 0) );

    if (ok) {
      alreadySentRef.current = true;
      void sendTicketsViaWhatsApp();
    }
  }, [ticketIds, generatedUrls, phone]);

  // URLs de PDF a mostrar (si el backend devuelve urls, se usan; si no, se construyen)
  const pdfUrls = useMemo<string[]>(() => {
    if (generatedUrls.length) return generatedUrls;
    return (ticketIds || []).map(buildTicketPdfUrl);
  }, [generatedUrls, ticketIds]);

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
    if (pdfUrls.length) {
      window.open(pdfUrls[0], "_blank", "noopener,noreferrer");
    }
  };

  // WhatsApp vía backend
  async function sendTicketsViaWhatsApp(): Promise<void> {
    try {
      setSendingWa(true);
      setSendErrWa(null);

      const cleanPhone = normalizeE164Mx(phone);
      if (!isValidPhone(cleanPhone)) {
        throw new Error("No se recibió teléfono para WhatsApp.");
      }
      const ids = ticketIds || [];
      if (!ids.length) throw new Error("No hay ticketIds para enviar.");

      await api.post("/whatsapp/send-tickets", {
        phone: cleanPhone,
        ticketIds: ids,
        introMessage:
          "¡Gracias por tu compra en NardeliTickets! Te enviamos tus boletos en PDF.",
      });

      setSentOkWa(true);
    } catch (err: any) {
      console.error("WA send error:", err);
      setSentOkWa(false);
      setSendErrWa(
        err?.response?.data?.error ||
          err?.message ||
          "Error al enviar por WhatsApp"
      );
    } finally {
      setSendingWa(false);
    }
  }

  // Generar PDFs manualmente (botón)
  const handleGeneratePdfs = async (): Promise<void> => {
    if (!orderId) return;
    setLoadingGen(true);
    setErrorGen(null);
    try {
      const { data } = await api.post(`/checkout/orders/${orderId}/tickets/generate`);
      const urls: string[] = Array.isArray(data?.files)
        ? data.files.map((f: any) => f.url).filter(Boolean)
        : [];
      const ids: string[] = Array.isArray(data?.files)
        ? data.files.map((f: any) => f.ticketId).filter(Boolean)
        : [];

      if (urls.length) setGeneratedUrls(urls);
      if (ids.length) setTicketIds(ids);

      if (!urls.length && !ids.length) {
        setErrorGen("No se generaron PDFs. Verifica que la orden esté pagada y tenga asientos vendidos.");
      }
    } catch (e: any) {
      setErrorGen(e?.response?.data?.message || "No se pudo generar los PDF(s).");
    } finally {
      setLoadingGen(false);
    }
  };

  const hasData = Boolean(orderId || (ticketIds && ticketIds.length));

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.icon}>✅</div>
        <h1 style={styles.title}>¡Pago confirmado!</h1>

        {sendingWa && <p>Enviando tus boletos por WhatsApp…</p>}
        {sentOkWa === true && (
          <p style={{ color: "#16a34a", marginTop: 8 }}>
            ✅ Boletos enviados por WhatsApp.
          </p>
        )}
        {sentOkWa === false && (
          <div style={{ ...styles.alert, marginTop: 8 }}>
            ❌ No se pudieron enviar por WhatsApp.<br />
            <span style={{ whiteSpace: "pre-wrap" }}>{sendErrWa}</span><br />
            <button onClick={sendTicketsViaWhatsApp} style={{ ...styles.secondaryBtn, marginTop: 8 }}>
              Reintentar envío
            </button>
          </div>
        )}

        <p style={styles.subtitle}>
          Tu compra se realizó con éxito. {orderId ? `Folio: #${orderId}` : ""}
        </p>

        {!hasData && (
          <div style={styles.alert}>
            No se recibieron <b>ticketIds</b> ni <b>orderId</b>. Regresa al inicio o intenta nuevamente.
          </div>
        )}

        {/* Acciones principales */}
        <div style={styles.actions}>
          {/* Generar PDFs */}
          <button
            onClick={handleGeneratePdfs}
            style={styles.secondaryBtn}
            disabled={!orderId || loadingGen}
            title={!orderId ? "Se requiere orderId" : undefined}
          >
            {loadingGen ? "Generando PDFs..." : "Generar PDFs (si no aparecen)"}
          </button>

          <button
            onClick={handleSendWhatsApp}
            style={styles.primaryBtn}
            disabled={sendingWa || !isValidPhone(phone) || (!pdfUrls.length && !ticketIds?.length)}
          >
            {sendingWa ? "Enviando por WhatsApp..." : "Enviar boletos por WhatsApp"}
          </button>

          <button onClick={handleOpenFirstPdf} style={styles.secondaryBtn} disabled={!pdfUrls.length}>
            Abrir primer PDF
          </button>
          <button onClick={handleCopyLinks} style={styles.secondaryBtn} disabled={!pdfUrls.length}>
            Copiar links
          </button>
        </div>

        {errorGen && (
          <div style={{ ...styles.alert, marginTop: 10 }}>{errorGen}</div>
        )}

        {/* Teléfono */}
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

        {/* Lista de PDFs */}
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
