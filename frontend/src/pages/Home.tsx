// src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import SimpleCarousel, { type Slide } from "../components/SimpleCarousel";
import type { EventItem } from "../types/Event";
import EventCard from "../components/EventCard";
import { fetchEvents } from "../api/events";
import "../CSS/Home.css";

// Slides estáticos (se mantienen)
const staticSlides: Slide[] = [
  {
    image:
      "https://images.unsplash.com/photo-1515165562835-c3b8c2b1d1b4?q=80&w=1600&auto=format&fit=crop",
    title: "Gran Noche de Concierto",
    subtitle: "Reserva tus boletos antes de que se agoten",
    ctaText: "Ver eventos",
    ctaHref: "/events",
  },
  {
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1600&auto=format&fit=crop",
    title: "Eventos Sociales en Nardeli",
    subtitle: "Paquetes especiales para tu celebración",
    ctaText: "Cotizar",
    ctaHref: "/events?category=social",
  },
  {
    image:
      "https://images.unsplash.com/photo-1486225060811-7f46265c7ea0?q=80&w=1600&auto=format&fit=crop",
    title: "Conferencias y Networking",
    subtitle: "Aprende y conecta con expertos",
    ctaText: "Explorar",
    ctaHref: "/events?category=conferencia",
  },
];

// Próxima fecha futura (timestamp) o null
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

  // Slides del carrusel: destacados publicados + slides estáticos (sin duplicados)
  const heroSlides: Slide[] = useMemo(() => {
    const featuredSlides: Slide[] = events
      .filter((e) => e.status === "published" && e.featured)
      .map((e) => ({
        image: e.imageUrl,
        title: e.title,
        subtitle: `${e.venue} — ${e.city}`,
        ctaText: "Ver evento",
        ctaHref: `/evento/${e.id}`,
      }));

    const merged = [...featuredSlides, ...staticSlides];

    // Quitar duplicados por (image + title)
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

  const onOpenEvent = (id: string) => {
    console.log("open event", id); // luego: navigate(`/evento/${id}`)
  };

  return (
    <main className="home u-container">
      {/* Hero con carrusel: destacados primero + estáticos */}
      <div className="home__hero">
        <SimpleCarousel slides={heroSlides} height={380} />
      </div>

      {/* Lista de eventos reales */}
      <section className="home__section">
        <div className="events__header u-flex-between">
          <h2>Próximos eventos</h2>
          <a href="/events">Ver todos</a>
        </div>

        {loading ? (
          <p className="u-mt-16">Cargando...</p>
        ) : upcoming.length === 0 ? (
          <p className="u-mt-16">No hay eventos publicados por ahora.</p>
        ) : (
          <div className="events__grid">
            {upcoming.map((ev) => (
              <EventCard
                key={ev.id}
                ev={ev}
                onClick={onOpenEvent}
                className="card card--clickable"
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
