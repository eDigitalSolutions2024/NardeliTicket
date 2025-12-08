// src/pages/Home.tsx
import  { useEffect, useMemo, useState } from "react";
import SimpleCarousel, { type Slide } from "../components/SimpleCarousel";
import type { EventItem } from "../types/Event";
import EventCard from "../components/EventCard";
import { fetchEvents } from "../api/events";
import "../CSS/Home.css";

// Slides estáticos
const staticSlides: Slide[] = [
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
];

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
        ctaHref: `/evento/${e.id}`,
      }));

    const merged = [...featuredSlides, ...staticSlides];
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

  const categories = [
    { key: "Conciertos", label: "Conciertos" },
    { key: "Teatro", label: "Teatro" },
    { key: "Deportes", label: "Deportes" },
    { key: "Familiares", label: "Familiares" },
    { key: "Especiales", label: "Especiales" },
  ];

  return (
    <main className="home u-container">

      {/* HERO mejorado con overlay */}
    <div className="home__hero enhanced-hero">
      <div className="enhanced-hero__bg-blur" aria-hidden />

      {/* Carrusel */}
      <SimpleCarousel slides={heroSlides} height={420} />

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


      {/* Categorías (chips) */}
      <section className="home__section">
        <div className="section-header">
          <h2>Explorar por categoría</h2>
        </div>
        <div className="chip-row">
          {categories.map((c) => (
            <a
              key={c.key}
              className="chip"
              href={`/events?category=${encodeURIComponent(c.key)}`}
            >
              {c.label}
            </a>
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
    <div className="events__grid">
      {upcoming.map((ev) => {
        // badge inteligente
        const next = (ev.sessions ?? [])
          .map(s => new Date(s.date).getTime())
          .filter(t => t >= Date.now())
          .sort((a,b) => a-b)[0];
        const daysLeft = next ? Math.ceil((next - Date.now()) / (1000*60*60*24)) : null;

        let badge: {text: string; variant: "hot"|"soon"|"featured"|null} = { text: "", variant: null };
        if (ev.featured) badge = { text: "Destacado", variant: "featured" };
        if (daysLeft !== null && daysLeft <= 2) badge = { text: "¡Mañana!", variant: "hot" };
        else if (daysLeft !== null && daysLeft <= 7) badge = { text: "Esta semana", variant: "soon" };

        return (
          <div key={ev.id} className="event-card-wrap">
            {/* overlay superior izquierdo */}
            {badge.variant && <span className={`ec-badge ec-${badge.variant}`}>{badge.text}</span>}

            {/* overlay inferior (fecha + ciudad) */}
            {next && (
              <div className="ec-overlay-meta">
                <span className="ec-chip">{new Date(next).toLocaleDateString()}</span>
                <span className="ec-dot" />
                <span className="ec-chip">{ev.city}</span>
              </div>
            )}

            {/* tu card tal cual */}
            <div className="card shell card--clickable">
              <EventCard ev={ev} className="card" onClick={() => {}} />
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>


      {/* CTA final */}
      <section className="home__cta">
        <div className="cta__content">
          <h3>¿Organizas un evento?</h3>
          <p>Vende tus boletos con NardeliTicket y recibe pagos al instante.</p>
          <div className="cta__actions">
            <a href="/auth/register" className="btn btn-primary">Crear cuenta</a>
            <a href="/events" className="btn btn-ghost">Ver eventos</a>
          </div>
        </div>
      </section>
    </main>
  );
}
