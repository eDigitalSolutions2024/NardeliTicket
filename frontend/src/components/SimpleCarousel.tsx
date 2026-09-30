import { useEffect, useRef, useState } from "react";
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
  intervalMs?: number; // default 5500
  height?: number; // px (desktop)
};

export default function SimpleCarousel({ slides, intervalMs = 5500, height = 520 }: Props) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);
  const paused = useRef(false);

  const n = slides.length;
  const go = (i: number) => setIdx(((i % n) + n) % n);
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  useEffect(() => {
    if (n <= 1) return;
    const tick = () => {
      if (!paused.current) setIdx((p) => (p + 1) % n);
    };
    timer.current = window.setInterval(tick, intervalMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs, n]);

  if (n === 0) {
    return (
      <div className="carousel" style={{ ["--carousel-h" as any]: `${height}px` }}>
        <div className="carousel__scrim" />
        <div className="carousel__caption">
          <span className="carousel__eyebrow">Próximamente</span>
          <h2 className="carousel__title">Aún no hay eventos destacados</h2>
          <p className="carousel__subtitle">Vuelve pronto para descubrir los próximos shows.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="carousel"
      style={{ ["--carousel-h" as any]: `${height}px` }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      aria-roledescription="carousel"
    >
      {slides.map((s, i) => (
        <div
          key={i}
          className={`carousel__slide ${i === idx ? "is-active" : ""}`}
          aria-hidden={i !== idx}
        >
          {/* fondo difuminado que rellena el banner */}
          <img className="carousel__img carousel__img--blur" src={s.image} alt="" aria-hidden loading={i === 0 ? "eager" : "lazy"} />
          {/* imagen completa sin recortes */}
          <img className="carousel__img carousel__img--full" src={s.image} alt={s.title || `slide-${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
          <div className="carousel__scrim" />

          <div className="carousel__caption">
            <span className="carousel__eyebrow">✦ {s.eyebrow || "Evento destacado"}</span>
            {s.title && <h2 className="carousel__title">{s.title}</h2>}
            {s.subtitle && <p className="carousel__subtitle">{s.subtitle}</p>}
            {s.ctaHref && (
              <Link to={s.ctaHref} className="carousel__cta btn btn-primary">
                {s.ctaText || "Ver evento"}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      ))}

      {n > 1 && (
        <>
          <button className="carousel__nav carousel__nav--prev" onClick={prev} aria-label="Anterior">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="carousel__nav carousel__nav--next" onClick={next} aria-label="Siguiente">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden>
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

          <div className="carousel__progress">
            <span key={idx} style={{ animationDuration: `${intervalMs}ms` }} />
          </div>
        </>
      )}
    </div>
  );
}
