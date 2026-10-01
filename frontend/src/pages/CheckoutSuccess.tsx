// src/pages/CheckoutSuccess.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { API_BASE, api } from "../api/client";
import "../CSS/CheckoutSuccess.css";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type LocationState = {
  orderId?: string;
  reservaId?: string;
  ticketIds?: string[];
  phone?: string;
  paymentMethod?: "card" | "cash";
  buyerName?: string;
};
type ZebraTicketPayload = {
  eventName: string; dateLabel: string; eventPlace?: string;
  orderFolio: string; zone: string; tableLabel: string;
  seatLabels: string[]; buyerName: string; priceLabel?: string; ticketCode: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizePhone(input: string) { return (input || "").replace(/\D/g, ""); }
function isValidPhone(raw?: string) { return sanitizePhone(raw || "").length >= 10; }
function normalizeE164Mx(raw: string) {
  const d = sanitizePhone(raw);
  return d.length === 10 ? `52${d}` : d;
}
function buildWaUrl(message: string, phone?: string) {
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
  } catch { return null; }
}
function buildOrderPdfUrl(orderId: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const apiRoot = base.replace(/\/api$/, "");
  return `${apiRoot}/files/tickets/tickets_order_${orderId}.pdf`;
}
function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Hook: cargar PDF como Blob URL ──────────────────────────────────────────
// Hace fetch al PDF con reintentos (por si el archivo aún se está escribiendo)
// y crea una object URL estable que se libera al desmontar.
function usePdfBlobUrl(srcUrl: string | null) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const blobRef = useRef<string | null>(null);        // URL actual (no se revoca hasta el próximo o unmount)
  const abortRef = useRef<AbortController | null>(null);

  // Limpia el blob al desmontar
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, []);

  useEffect(() => {
    if (!srcUrl) return;

    // Cancela fetch anterior si existía
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setFetching(true);
    setFetchError(false);
    setDisplayUrl(null);

    (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (ctrl.signal.aborted) return;
        try {
          const res = await fetch(srcUrl, { signal: ctrl.signal });
          if (!res.ok) {
            if (attempt < 4) { await delay(1200); continue; }
            throw new Error(`HTTP ${res.status}`);
          }

          // Verificar que la respuesta sea realmente un PDF y no HTML (página de error de Express)
          const ct = res.headers.get("Content-Type") || "";
          const isPdf = ct.includes("application/pdf") || ct.includes("octet-stream");
          if (!isPdf) {
            console.warn(`[PDF] Intento ${attempt + 1}: Content-Type no es PDF → "${ct}"`);
            if (attempt < 4) { await delay(1200); continue; }
            throw new Error(`No es PDF (Content-Type: ${ct})`);
          }

          const blob = await res.blob();
          if (blob.size < 500) {
            if (attempt < 4) { await delay(1200); continue; }
            throw new Error("PDF vacío");
          }
          if (ctrl.signal.aborted) return;
          if (blobRef.current) URL.revokeObjectURL(blobRef.current);
          const url = URL.createObjectURL(blob);
          blobRef.current = url;
          setDisplayUrl(url);
          setFetching(false);
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          if (attempt === 4) {
            setFetchError(true);
            setFetching(false);
          } else {
            await delay(1200);
          }
        }
      }
    })();
  }, [srcUrl]);

  return { displayUrl, fetching, fetchError };
}

// ─── Componente visor ─────────────────────────────────────────────────────────
function PdfFrame({
  pdfUrl,
  onOpenPdf,
  onDownloadPdf,
  generando,
  orderId,
  onGenerate,
  loadingGen,
}: {
  pdfUrl: string | null;
  onOpenPdf: () => void;
  onDownloadPdf: () => void;
  generando: boolean;
  orderId?: string;
  onGenerate: () => void;
  loadingGen: boolean;
}) {
  const { displayUrl, fetching, fetchError } = usePdfBlobUrl(generando ? null : pdfUrl);

  if (generando) {
    return (
      <div className="checkout-pdf-state">
        <div className="checkout-spinner" />
        <h3 className="checkout-pdf-state-title">Generando tus boletos...</h3>
        <p className="checkout-pdf-state-desc">
          Estamos emitiendo tus códigos QR y asignando tus lugares. Solo unos segundos.
        </p>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="checkout-pdf-state">
        <div className="checkout-spinner" />
        <h3 className="checkout-pdf-state-title">Cargando tu boleto...</h3>
        <p className="checkout-pdf-state-desc">Preparando la vista previa...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="checkout-pdf-state">
        <div className="checkout-pdf-error-icon">📄</div>
        <h3 className="checkout-pdf-state-title">Vista previa no disponible</h3>
        <p className="checkout-pdf-state-desc">
          Tu boleto está listo. Ábrelo o descárgalo directamente.
        </p>
        <div className="checkout-pdf-error-actions">
          <button type="button" onClick={onOpenPdf} className="checkout-btn checkout-btn-primary">
            Abrir PDF
          </button>
          <button type="button" onClick={onDownloadPdf} className="checkout-btn checkout-btn-secondary">
            Descargar
          </button>
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="checkout-pdf-state">
        <div className="checkout-pdf-error-icon">🎟️</div>
        <h3 className="checkout-pdf-state-title">Boleto Digital</h3>
        <p className="checkout-pdf-state-desc">Genera tu archivo PDF para ver tus entradas.</p>
        <button
          type="button" onClick={onGenerate}
          className="checkout-btn checkout-btn-primary"
          disabled={loadingGen || !orderId}
        >
          Generar boletos
        </button>
      </div>
    );
  }

  if (displayUrl) {
    return (
      <iframe
        key={displayUrl}
        src={displayUrl}
        style={{ width: "100%", height: "100%", border: "none", display: "block", background: "#fff" }}
        title="Boleto Digital NardeliTicket"
      />
    );
  }

  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CheckoutSuccess() {
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const [searchParams] = useSearchParams();

  const sessionId = searchParams.get("session_id");
  const pmQuery = searchParams.get("pm");

  const orderId =
    state.orderId || state.reservaId ||
    searchParams.get("orderId") || searchParams.get("order") ||
    searchParams.get("reservaId") || undefined;

  const paymentMethod: "card" | "cash" =
    state.paymentMethod ||
    (pmQuery === "cash" ? "cash" : pmQuery === "card" ? "card" : !sessionId ? "cash" : "card");

  const buyerName: string = state.buyerName || searchParams.get("buyerName") || "";

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
  const [orderPdfUrl, setOrderPdfUrl] = useState<string | null>(null);
  const [loadingGen, setLoadingGen] = useState(false);
  const [errorGen, setErrorGen] = useState<string | null>(null);
  const [autoRequestedFor, setAutoRequestedFor] = useState<string | null>(null);
  const [copiedFolio, setCopiedFolio] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [phone, setPhone] = useState<string>(() => {
    const fromState = sanitizePhone(state.phone || "");
    const fromQuery = sanitizePhone(searchParams.get("phone") || "");
    const fromStorage = sanitizePhone(getPhoneFromStorage() || "");
    return fromState || fromQuery || fromStorage || "";
  });
  const [sendingWa, setSendingWa] = useState(false);
  const [sentOkWa, setSentOkWa] = useState<boolean | null>(null);
  const [sendErrWa, setSendErrWa] = useState<string | null>(null);
  const alreadySentRef = useRef(false);
  const zebraPrintedRef = useRef(false);

  // 1) Polling tarjeta
  useEffect(() => {
    let cancelled = false;
    if (paymentMethod !== "card") return;
    if (!orderId || (ticketIds && ticketIds.length)) return;
    let attempts = 0;
    async function tryFetchTickets() {
      attempts++;
      try {
        const { data } = await api.get<string[]>(`/checkout/orders/${orderId}/tickets`);
        if (!cancelled && Array.isArray(data) && data.length) { setTicketIds(data); return; }
      } catch {}
      if (!cancelled && attempts < 5) setTimeout(tryFetchTickets, 1500);
    }
    (async () => {
      try { await api.get(`/checkout/orders/${orderId}/status`); } catch {}
      if (!cancelled) tryFetchTickets();
    })();
    return () => { cancelled = true; };
  }, [orderId, ticketIds, paymentMethod]);

  // 2) Autogenerar PDFs
  useEffect(() => {
    if (!orderId || orderPdfUrl || autoRequestedFor === orderId) return;
    if (paymentMethod === "card" && (!ticketIds || !ticketIds.length)) return;
    setAutoRequestedFor(orderId);
    (async () => {
      try {
        setLoadingGen(true);
        setErrorGen(null);
        const { data } = await api.post(`/checkout/orders/${orderId}/tickets/generate`);
        const mergedUrl = data?.merged?.url || data?.file?.url || buildOrderPdfUrl(orderId);
        setOrderPdfUrl(mergedUrl);
        const ids: string[] = Array.isArray(data?.files)
          ? data.files.map((f: any) => f.ticketId).filter(Boolean) : [];
        if (ids.length) setTicketIds(ids);
      } catch {
        setOrderPdfUrl(buildOrderPdfUrl(orderId));
      } finally {
        setLoadingGen(false);
      }
    })();
  }, [orderId, ticketIds, orderPdfUrl, paymentMethod, autoRequestedFor]);

  // 3) Zebra efectivo
  useEffect(() => {
    if (paymentMethod !== "cash" || !orderId || zebraPrintedRef.current) return;
    zebraPrintedRef.current = true;
    const payload: ZebraTicketPayload = {
      eventName: "NardeliTicket", dateLabel: new Date().toLocaleString("es-MX"),
      eventPlace: "", orderFolio: orderId, zone: "GENERAL", tableLabel: "",
      seatLabels: [], buyerName: buyerName || "", priceLabel: "", ticketCode: orderId,
    };
    fetch("http://localhost:5050/print-cash-ticket", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [paymentMethod, orderId, buyerName]);

  const finalPdfUrl = orderPdfUrl || (orderId ? buildOrderPdfUrl(orderId) : "");

  // 4) Auto WhatsApp
  useEffect(() => {
    if (alreadySentRef.current) return;
    if (sanitizePhone(phone) && orderPdfUrl) {
      alreadySentRef.current = true;
      void sendTicketsViaWhatsApp();
    }
  }, [orderPdfUrl, phone]);

  const messageText = useMemo<string>(() => {
    const header = `¡Hola! Aquí están tus boletos oficiales de NardeliTicket 🎟️`;
    const folio = orderId ? `\nFolio / Orden: #${orderId}` : "";
    const link = finalPdfUrl ? `\n\nTu boleto (PDF):\n${finalPdfUrl}` : "";
    return `${header}${folio}${link}\n\n¡Gracias por tu compra!`;
  }, [orderId, finalPdfUrl]);

  async function sendTicketsViaWhatsApp(): Promise<void> {
    try {
      setSendingWa(true); setSendErrWa(null);
      const cleanPhone = normalizeE164Mx(phone);
      if (!isValidPhone(cleanPhone)) throw new Error("Ingresa un número válido con lada.");
      const ids = ticketIds || [];
      if (!ids.length) {
        window.open(buildWaUrl(messageText, phone), "_blank", "noopener,noreferrer");
        setSentOkWa(true); return;
      }
      await api.post("/whatsapp/send-tickets", {
        phone: cleanPhone, ticketIds: ids,
        introMessage: "¡Gracias por tu compra en NardeliTickets! Te enviamos tus boletos en PDF.",
      });
      setSentOkWa(true);
    } catch (err: any) {
      setSentOkWa(false);
      setSendErrWa(err?.response?.data?.error || err?.message || "Error al enviar por WhatsApp");
    } finally { setSendingWa(false); }
  }

  const handleOpenPdf = () => { if (finalPdfUrl) window.open(finalPdfUrl, "_blank", "noopener,noreferrer"); };
  const handleDownloadPdf = () => {
    if (!finalPdfUrl) return;
    const a = document.createElement("a");
    a.href = finalPdfUrl; a.download = `boletos_orden_${orderId || "nardeli"}.pdf`;
    a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  const handleCopyFolio = async () => {
    if (!orderId) return;
    await navigator.clipboard.writeText(orderId).catch(() => {});
    setCopiedFolio(true); setTimeout(() => setCopiedFolio(false), 2500);
  };
  const handleCopyPdfLink = async () => {
    if (!finalPdfUrl) return;
    await navigator.clipboard.writeText(finalPdfUrl).catch(() => {});
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2500);
  };
  const handleGeneratePdfs = async () => {
    if (!orderId) return;
    setLoadingGen(true); setErrorGen(null);
    try {
      const { data } = await api.post(`/checkout/orders/${orderId}/tickets/generate`);
      const mergedUrl = data?.merged?.url || data?.file?.url || buildOrderPdfUrl(orderId);
      setOrderPdfUrl(mergedUrl);
      const ids: string[] = Array.isArray(data?.files)
        ? data.files.map((f: any) => f.ticketId).filter(Boolean) : [];
      if (ids.length) setTicketIds(ids);
    } catch (e: any) {
      setErrorGen(e?.response?.data?.message || "No se pudo generar el PDF.");
    } finally { setLoadingGen(false); }
  };

  const hasData = Boolean(orderId || (ticketIds && ticketIds.length));

  return (
    <div className="checkout-page">
      <div className="checkout-backdrop" />
      <div className="checkout-container">

        {/* ── 1. HERO ── */}
        <section className="checkout-hero-card">
          <div className="checkout-check-badge">✓</div>
          <h1 className="checkout-hero-title">¡Pago confirmado!</h1>
          <p className="checkout-hero-subtitle">
            Tu compra se realizó con éxito. Tus boletos están listos y asegurados en el sistema.
          </p>
          <div className="checkout-meta-pills">
            {orderId && (
              <button type="button" className="checkout-pill checkout-pill-folio" onClick={handleCopyFolio}>
                <span>Folio:</span><strong>#{orderId}</strong>
                <span className="checkout-pill-copy-icon">{copiedFolio ? "✓ Copiado" : "📋"}</span>
              </button>
            )}
            <div className="checkout-pill">
              <span>Método:</span>
              <strong>{paymentMethod === "cash" ? "Efectivo en taquilla" : "Tarjeta / pago en línea"}</strong>
            </div>
            {buyerName && (
              <div className="checkout-pill"><span>Cliente:</span><strong>{buyerName}</strong></div>
            )}
          </div>
          {!hasData && (
            <div className="checkout-feedback-error" style={{ marginTop: 20 }}>
              No se recibieron datos de orden o boletos.
            </div>
          )}
        </section>

        {/* ── 2. PDF ── */}
        <section className="checkout-ticket-card">
          <div className="checkout-ticket-header">
            <div className="checkout-ticket-header-info">
              <h2>🎟️ Tus Boletos Oficiales</h2>
              <p>Presenta este archivo en el acceso desde tu celular o imprímelo con anticipación.</p>
            </div>
            <div className="checkout-ticket-badge"><span>●</span> Válido para acceso</div>
          </div>

          <div className="checkout-pdf-frame-wrapper">
            <PdfFrame
              pdfUrl={orderPdfUrl}
              onOpenPdf={handleOpenPdf}
              onDownloadPdf={handleDownloadPdf}
              generando={loadingGen}
              orderId={orderId}
              onGenerate={handleGeneratePdfs}
              loadingGen={loadingGen}
            />
          </div>

          <div className="checkout-actions-row">
            <button type="button" onClick={handleOpenPdf}
              className="checkout-btn checkout-btn-primary" disabled={!finalPdfUrl}>
              📄 Abrir PDF
            </button>
            <button type="button" onClick={handleDownloadPdf}
              className="checkout-btn checkout-btn-secondary" disabled={!finalPdfUrl}>
              ⬇️ Descargar PDF
            </button>
            <button type="button" onClick={handleCopyPdfLink}
              className="checkout-btn checkout-btn-secondary" disabled={!finalPdfUrl}>
              {copiedLink ? "✓ ¡Copiado!" : "📋 Copiar enlace"}
            </button>
            {(!orderPdfUrl || errorGen) && (
              <button type="button" onClick={handleGeneratePdfs}
                className="checkout-btn checkout-btn-secondary"
                disabled={loadingGen || !orderId}>
                🔄 {loadingGen ? "Generando..." : "Regenerar"}
              </button>
            )}
          </div>
          {errorGen && <div className="checkout-feedback-error"><span>{errorGen}</span></div>}
        </section>

        {/* ── 3. WHATSAPP ── */}
        <section className="checkout-whatsapp-card">
          <div className="checkout-wa-header">
            <div className="checkout-wa-icon-box">💬</div>
            <div className="checkout-wa-title-group">
              <h3>¿Quieres recibirlos en tu WhatsApp?</h3>
              <p>Te enviamos el enlace directo para que lo tengas siempre disponible.</p>
            </div>
          </div>
          <div className="checkout-wa-form">
            <div className="checkout-wa-input-row">
              <span className="checkout-wa-prefix">+</span>
              <input type="tel" value={phone}
                onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                placeholder="521XXXXXXXXXX" className="checkout-wa-input" />
              <button type="button" onClick={sendTicketsViaWhatsApp}
                className="checkout-btn-whatsapp"
                disabled={sendingWa || !isValidPhone(phone) || !finalPdfUrl}>
                {sendingWa ? "Enviando..." : "Enviar por WhatsApp"}
              </button>
            </div>
            <p className="checkout-wa-hint">Ingresa el número con clave de país (ej. 52 + 10 dígitos).</p>
          </div>
          {sentOkWa === true && (
            <div className="checkout-feedback-success">✅ ¡Boletos enviados exitosamente a tu WhatsApp!</div>
          )}
          {sentOkWa === false && (
            <div className="checkout-feedback-error">
              <strong>No se pudo enviar:</strong>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>{sendErrWa}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={sendTicketsViaWhatsApp}
                  className="checkout-btn checkout-btn-secondary"
                  style={{ padding: "6px 14px", fontSize: "0.85rem" }}>Reintentar</button>
                <button type="button"
                  onClick={() => window.open(buildWaUrl(messageText, phone), "_blank", "noopener,noreferrer")}
                  className="checkout-btn-whatsapp"
                  style={{ padding: "6px 14px", fontSize: "0.85rem" }}>Abrir WhatsApp directo</button>
              </div>
            </div>
          )}
        </section>

        {/* ── 4. FOOTER ── */}
        <footer className="checkout-footer-card">
          <p className="checkout-footer-note">
            Guarda tu folio y tu PDF. Recuerda tener a mano tu código QR el día del evento.
          </p>
          <Link to="/" className="checkout-btn-home">← Volver a la cartelera de eventos</Link>
        </footer>

      </div>
    </div>
  );
}
