// src/pages/Home.tsx
import  { useEffect, useMemo, useState } from "react";
import SimpleCarousel, { type Slide } from "../components/SimpleCarousel";
import type { EventItem } from "../types/Event";
import EventTile from "../components/EventTile";
import WebGLParticles from "../components/WebGLParticles";
import { fetchEvents } from "../api/events";
import salonImg from "../assets/salon.jpg";
import "../CSS/Home.css";

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
      <WebGLParticles className="home__particles" ambient={0.35} />

      {/* HERO mejorado con overlay */}
    <div className="home__hero enhanced-hero">
      <div className="enhanced-hero__bg-blur" aria-hidden />

      {/* Carrusel */}
      <SimpleCarousel slides={heroSlides} height={580} />
    </div>



{/* Próximos eventos + publicidad del salón */}
<section className="home__section home__layout">
  <div className="home__main">
    <div className="events__header">
      <h2>Próximos eventos</h2>
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
  </div>

  
</section>

{/* Columna de publicidad del salón */}
  <aside className="salon-ad" aria-label="Salón Nardeli">
    <img className="salon-ad__img" src={salonImg} alt="Salón de eventos Nardeli" />
    <div className="salon-ad__scrim" />
    <div className="salon-ad__body">
      <span className="salon-ad__tag">Salón de eventos</span>
      <h3 className="salon-ad__title">Haz tu evento en Nardeli</h3>
      <p className="salon-ad__text">
        Bodas, XV años, conciertos y celebraciones en un espacio único.
      </p>
      <ul className="salon-ad__list">
        <li>Capacidad para tus invitados</li>
        <li>Iluminación y sonido profesional</li>
        <li>Atención personalizada</li>
      </ul>
      <a className="btn btn-primary salon-ad__cta" href="/events">Cotizar mi evento</a>
    </div>
  </aside>


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
