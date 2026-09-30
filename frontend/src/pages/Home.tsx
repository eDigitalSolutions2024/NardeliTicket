// src/pages/Home.tsx
import  { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SimpleCarousel, { type Slide } from "../components/SimpleCarousel";
import type { EventItem } from "../types/Event";
import EventTile from "../components/EventTile";
import WebGLParticles from "../components/WebGLParticles";
import { fetchEvents } from "../api/events";
import "../CSS/Home.css";

const CATEGORIES = [
  { key: "Conciertos", icon: "🎤", c1: "#7c3aed", c2: "#a855f7" },
  { key: "Teatro", icon: "🎭", c1: "#9333ea", c2: "#c084fc" },
  { key: "Deportes", icon: "⚽", c1: "#6d28d9", c2: "#8b5cf6" },
  { key: "Familiares", icon: "🎈", c1: "#a21caf", c2: "#d946ef" },
  { key: "Especiales", icon: "✨", c1: "#7c3aed", c2: "#ec4899" },
];

// Slides estáticos
{/*const staticSlides: Slide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1515165562835-c3b8c2b1d1b4?q=80&w=1600&auto=format&fit=crop",
    title: "Gran Noche de Concierto",
    subtitle: "Reserva tus boletos antes de que se agoten",
    ctaHref: "/events",
  },
  {
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1600&auto=format&fit=crop",
    title: "Eventos Sociales en Nardeli",
    subtitle: "Paquetes especiales para tu celebración",
    ctaHref: "/events?category=social",
  },
  {
    image:
      "https://images.unsplash.com/photo-1486225060811-7f46265c7ea0?q=80&w=1600&auto=format&fit=crop",
    title: "Conferencias y Networking",
    subtitle: "Aprende y conecta con expertos",
    ctaHref: "/events?category=conferencia",
  },
];*/}

const getNextDate = (ev: EventItem) => {
  const now = Date.now();
  const future = (ev.sessions ?? [])
    .map((s) => new Date(s.date).getTime())
    .filter((t) => t >= now)
    .sort((a, b) => a - b);
  return future[0] ?? null;
};

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchEvents();
        setEvents(all);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Slides del carrusel: destacados publicados + estáticos (sin duplicados)
  const heroSlides: Slide[] = useMemo(() => {
    const featuredSlides: Slide[] = events
      .filter((e) => e.status === "published" && e.featured)
      .map((e) => ({
        image: e.imageUrl,
        title: e.title,
        subtitle: `${e.venue} — ${e.city}`,
        ctaHref: `/events/${e.id}`,
      }));

    const merged = [...featuredSlides];
    const seen = new Set<string>();
    return merged.filter((s) => {
      const key = `${s.image}|${s.title ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events]);

  // publicados y con próxima fecha, ordenados por la más cercana
  const upcoming = useMemo(() => {
    return events
      .filter((e) => e.status === "published")
      .map((e) => ({ ev: e, next: getNextDate(e) }))
      .filter((x) => x.next)
      .sort((a, b) => a.next! - b.next!)
      .map((x) => x.ev);
  }, [events]);

  /*const categories = [
    { key: "Conciertos", label: "Conciertos" },
    { key: "Teatro", label: "Teatro" },
    { key: "Deportes", label: "Deportes" },
    { key: "Familiares", label: "Familiares" },
    { key: "Especiales", label: "Especiales" },
  ];*/

  return (
    <main className="home u-container">
      {/* Fondo azul oscuro a pantalla completa (como el splash) */}
      <div className="page-backdrop" aria-hidden />
      <WebGLParticles className="home__particles" ambient={0.5} />

      {/* HERO mejorado con overlay */}
    <div className="home__hero enhanced-hero">
      <div className="enhanced-hero__bg-blur" aria-hidden />

      {/* Carrusel */}
      <SimpleCarousel slides={heroSlides} height={460} />

      {/* Stats flotando arriba */}
      <div className="enhanced-hero__stats top">
        <div className="stat">
          <span className="num">{upcoming.length}</span>
          <span className="txt">Eventos activos</span>
        </div>
        <div className="stat">
          <span className="num">100%</span>
          <span className="txt">Pagos seguros</span>
        </div>
        <div className="stat">
          <span className="num">24/7</span>
          <span className="txt">Soporte</span>
        </div>
      </div>
    </div>


      {/* Categorías */}
      <section className="home__section home__section--cats">
        <div className="events__header">
          <h2>Explora por categoría</h2>
        </div>
        <div className="tm-cats">
          {CATEGORIES.map((c) => (
            <Link
              key={c.key}
              to={`/events?category=${encodeURIComponent(c.key)}`}
              className="tm-cat"
              style={{ ["--c1" as any]: c.c1, ["--c2" as any]: c.c2 }}
            >
              <span className="tm-cat__icon" aria-hidden>{c.icon}</span>
              <span className="tm-cat__label">{c.key}</span>
            </Link>
          ))}
        </div>
      </section>

{/* Próximos eventos */}
<section className="home__section">
  <div className="events__header u-flex-between">
    <h2>Próximos eventos</h2>
    <div className="events__tools">
      <span className="events__count">{upcoming.length} eventos</span>
      <select
        className="events__sort"
        onChange={(e) => {
          const v = e.target.value;
          if (v === "soon") {
            // ya vienen ordenados por fecha cercana 👍
            return;
          }
          if (v === "new") {
            const byCreated = [...upcoming].sort(
              (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
            );
            setEvents((prev) => {
              // mantenemos el resto de estado pero mostramos “byCreated” en lugar de upcoming
              const ids = new Set(byCreated.map((x) => x.id));
              return [...prev].sort((a, b) => (ids.has(a.id) && ids.has(b.id)
                ? byCreated.findIndex(x => x.id === a.id) - byCreated.findIndex(x => x.id === b.id)
                : 0));
            });
          }
        }}
        defaultValue="soon"
      >
        <option value="soon">Más cercanos</option>
        <option value="new">Recientes</option>
      </select>
      <a className="link-quiet" href="/events">Ver todos</a>
    </div>
  </div>

  {loading ? (
    <div className="events__grid">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card-skeleton" />)}
    </div>
  ) : upcoming.length === 0 ? (
    <p className="u-mt-16 muted">No hay eventos publicados por ahora.</p>
  ) : (
    <div className="tm-grid">
      {upcoming.map((ev) => (
        <EventTile key={ev.id} ev={ev} />
      ))}
    </div>
  )}
</section>


      {/* CTA final */}
      <section className="home__cta">
        <div className="cta__content">
          <h3>¿Organizas un evento?</h3>
          <p>Vende tus boletos con NardeliTicket y recibe pagos al instante.</p>
          <div className="cta__actions">
            <a href="/auth?tab=register" className="btn btn-primary">Crear cuenta</a>
            <a href="/events" className="btn btn-ghost">Ver eventos</a>
          </div>
        </div>
      </section>
    </main>
  );
}
