import React, { useEffect, useRef, useState } from "react";

export type Slide = {
  image: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
};

type Props = {
  slides: Slide[];
  intervalMs?: number; // default 4000
  height?: number;     // px, default 360
  rounded?: boolean;   // default true
};

export default function SimpleCarousel({
  slides,
  intervalMs = 4000,
  height = 360,
  rounded = true,
}: Props) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);
  const paused = useRef(false);

  const go = (n: number) => setIdx((_p) => (n + slides.length) % slides.length);
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  useEffect(() => {
    if (paused.current) return;
    timer.current = window.setInterval(() => {
      setIdx((p) => (p + 1) % slides.length);
    }, intervalMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [idx, intervalMs, slides.length]);

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: rounded ? 16 : 0,
        overflow: "hidden",
        background: "#0b1220",
      }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {slides.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            transition: "opacity 500ms ease",
            opacity: i === idx ? 1 : 0,
          }}
          aria-hidden={i !== idx}
        >
          <img
            src={s.image}
            alt={s.title || `slide-${i + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.85)" }}
            loading="eager"
          />
          {(s.title || s.subtitle || s.ctaText) && (
            <div
              style={{
                position: "absolute",
                left: 24,
                bottom: 24,
                color: "#fff",
                textShadow: "0 2px 10px rgba(0,0,0,.35)",
                maxWidth: 640,
              }}
            >
              {s.title && <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{s.title}</h2>}
              {s.subtitle && <p style={{ margin: "6px 0 12px 0", fontSize: 16 }}>{s.subtitle}</p>}
              {s.ctaText && s.ctaHref && (
                <a
                  href={s.ctaHref}
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    background: "#0ea5e9",
                    color: "#fff",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  {s.ctaText}
                </a>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Controles */}
      <button
        onClick={prev}
        aria-label="Anterior"
        style={navBtnStyle("left")}
      >
        ◀
      </button>
      <button
        onClick={next}
        aria-label="Siguiente"
        style={navBtnStyle("right")}
      >
        ▶
      </button>

      {/* Dots */}
      <div style={{ position: "absolute", bottom: 12, width: "100%", textAlign: "center" }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Ir al slide ${i + 1}`}
            style={{
              width: 10,
              height: 10,
              margin: "0 4px",
              borderRadius: 999,
              border: "none",
              background: i === idx ? "#fff" : "rgba(255,255,255,.5)",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function navBtnStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 8,
    background: "rgba(0,0,0,.45)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontSize: 16,
  } as React.CSSProperties;
}
