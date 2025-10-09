import React from "react";

export type EventItem = {
  id: string;
  title: string;
  date: string;     // ISO o display
  city: string;
  venue: string;
  image: string;
  priceFrom: number;
  available?: boolean;
};

type Props = {
  ev: EventItem;
  onClick?: (id: string) => void;
  className?: string;
};

export default function EventCard({ ev, onClick }: Props) {
  return (
    <article
      onClick={() => onClick?.(ev.id)}
      role="button"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        background: "#fff",
      }}
    >
      <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
        <img
          src={ev.image}
          alt={ev.title}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .3s" }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />
        {!ev.available && (
          <span
            style={{
              position: "absolute", top: 8, left: 8,
              background: "#ef4444", color: "#fff",
              padding: "4px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700
            }}
          >
            Agotado
          </span>
        )}
      </div>
      <div style={{ padding: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{ev.title}</h3>
        <p style={{ margin: "4px 0", color: "#64748b", fontSize: 13 }}>
          {ev.date} · {ev.city} — {ev.venue}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Desde ${ev.priceFrom}</strong>
          <button
            style={{
              height: 32, padding: "0 10px",
              border: "1px solid #0ea5e9", background: "#0ea5e9",
              color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 700
            }}
          >
            Ver
          </button>
        </div>
      </div>
    </article>
  );
}
