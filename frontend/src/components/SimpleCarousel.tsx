import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./Carousel.css";

export type Slide = {
  image: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  eyebrow?: string;
};

type Props = {
  slides: Slide[];
  intervalMs?: number;
  height?: number;
};

export default function SimpleCarousel({ slides, intervalMs = 5500, height = 540 }: Props) {
  const [idx, setIdx] = useState(0);
  const [w, setW] = useState(1200);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const paused = useRef(false);

  const n = slides.length;
  const go = (i: number) => setIdx(((i % n) + n) % n);
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  // medir ancho del escenario
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (n <= 1) return;
    const t = window.setInterval(() => {
      if (!paused.current) setIdx((p) => (p + 1) % n);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, n]);

  if (n === 0) {
    return (
      <div className="cf" style={{ ["--carousel-h" as any]: `${height}px` }}>
        <div className="cf__empty">
          <span className="cf__badge">
            <span className="cf__badge-star">✦</span>
            <span>PRÓXIMAMENTE</span>
          </span>
          <h2 className="cf__title">Aún no hay eventos destacados</h2>
        </div>
      </div>
    );
  }

  // Dimensiones amplias para que la imagen luzca en su totalidad sin limitaciones
  const isMobile = w < 640;
  const isTablet = w >= 640 && w < 1024;

  let cardW: number;
  if (isMobile) {
    cardW = Math.round(w * 0.92);
  } else if (isTablet) {
    cardW = Math.round(w * 0.68);
  } else {
    // Desktop: amplio para dar formato cinematográfico a la imagen (54% de ancho)
    cardW = Math.min(960, Math.max(560, Math.round(w * 0.54)));
  }

  const spacing = isMobile ? cardW * 0.94 : cardW * 0.62;
  const activeSlide = slides[idx];

  return (
    <div
      className="cf"
      style={{ ["--carousel-h" as any]: `${height}px` }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      aria-roledescription="carousel"
    >
      {/* 1. Escenario 3D de imágenes (actúan como fondo con tono atenuado) */}
      <div className="cf__stage" ref={stageRef}>
        {slides.map((s, i) => {
          let diff = i - idx;
          if (diff > n / 2) diff -= n;
          if (diff < -n / 2) diff += n;

          const abs = Math.abs(diff);
          const isCenter = diff === 0;
          const visible = isMobile ? abs <= 1 : abs <= 2;

          const translate = diff * spacing;
          const scale = isCenter ? 1 : abs === 1 ? (isMobile ? 0.85 : 0.80) : 0.66;
          const rotateY = diff === 0 ? 0 : diff > 0 ? -14 : 14;
          const opacity = visible ? (isCenter ? 1 : abs === 1 ? (isMobile ? 0.35 : 0.65) : 0.3) : 0;
          const zIndex = isCenter ? 25 : 20 - abs;

          return (
            <div
              key={i}
              className={`cf__card ${isCenter ? "is-center" : "is-lateral"}`}
              aria-hidden={!isCenter}
              onClick={() => !isCenter && visible && go(i)}
              style={{
                width: cardW,
                zIndex,
                opacity,
                pointerEvents: visible ? "auto" : "none",
                transform: `translate(-50%, -50%) translateX(${translate}px) scale(${scale}) rotateY(${rotateY}deg)`,
              }}
            >
              <img
                className="cf__img"
                src={s.image}
                alt={s.title || `slide-${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
              />
              <div className="cf__card-scrim" />
            </div>
          );
        })}
      </div>

      {/* 2. Velo suave que integra las imágenes como fondo */}
      <div className="cf__stage-scrim" aria-hidden="true" />

      {/* 3. Información del evento activo en primer plano (FUERA DE LAS TARJETAS) */}
      {activeSlide && (
        <div key={idx} className="cf__foreground-content">
          <div className="cf__badge">
            <span className="cf__badge-star" aria-hidden="true">✦</span>
            <span>EVENTO DESTACADO</span>
          </div>

          {activeSlide.title && (
            <h2 className="cf__title">{activeSlide.title}</h2>
          )}

          {activeSlide.subtitle && (
            <div className="cf__location">
              <span className="cf__pin" aria-hidden="true">📍</span>
              <span className="cf__location-text">{activeSlide.subtitle.replace(/^📍\s*/, "")}</span>
            </div>
          )}

          {activeSlide.ctaHref && (
            <div className="cf__actions">
              <Link to={activeSlide.ctaHref} className="cf__btn-hero">
                <span>{activeSlide.ctaText || "Ver evento"}</span>
                <span className="cf__btn-arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 4. Controles de navegación */}
      {n > 1 && (
        <>
          <button className="carousel__nav carousel__nav--prev" onClick={prev} aria-label="Anterior">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="carousel__nav carousel__nav--next" onClick={next} aria-label="Siguiente">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="carousel__dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`carousel__dot ${i === idx ? "is-active" : ""}`}
                onClick={() => go(i)}
                aria-label={`Ir al slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
