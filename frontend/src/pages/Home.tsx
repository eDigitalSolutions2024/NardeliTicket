import React from "react";
import SimpleCarousel, { type Slide } from "../components/SimpleCarousel";
import EventCard, { type EventItem } from "../components/EventCard";



const slides: Slide[] = [
  {
    image: "https://images.unsplash.com/photo-1515165562835-c3b8c2b1d1b4?q=80&w=1600&auto=format&fit=crop",
    title: "Gran Noche de Concierto",
    subtitle: "Reserva tus boletos antes de que se agoten",
    ctaText: "Ver eventos",
    ctaHref: "/events",
  },
  {
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1600&auto=format&fit=crop",
    title: "Eventos Sociales en Nardeli",
    subtitle: "Paquetes especiales para tu celebración",
    ctaText: "Cotizar",
    ctaHref: "/events?category=social",
  },
  {
    image: "https://images.unsplash.com/photo-1486225060811-7f46265c7ea0?q=80&w=1600&auto=format&fit=crop",
    title: "Conferencias y Networking",
    subtitle: "Aprende y conecta con expertos",
    ctaText: "Explorar",
    ctaHref: "/events?category=conferencia",
  },
];

const mockEvents: EventItem[] = [
  {
    id: "1",
    title: "Sinfonía bajo las estrellas",
    date: "Vie 18 Oct, 8:00 PM",
    city: "Ciudad Juárez",
    venue: "Salón Nardeli",
    image: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?q=80&w=1200&auto=format&fit=crop",
    priceFrom: 350,
    available: true,
  },
  {
    id: "2",
    title: "Stand-Up Night",
    date: "Sáb 26 Oct, 9:30 PM",
    city: "Ciudad Juárez",
    venue: "Salón Nardeli",
    image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=1200&auto=format&fit=crop",
    priceFrom: 250,
    available: true,
  },
  {
    id: "3",
    title: "Expo Bodas 2025",
    date: "Dom 27 Oct, 12:00 PM",
    city: "El Paso, TX",
    venue: "Convention Hall",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1200&auto=format&fit=crop",
    priceFrom: 0,
    available: true,
  },
  {
    id: "4",
    title: "Festival Gastronómico",
    date: "Sáb 02 Nov, 2:00 PM",
    city: "Ciudad Juárez",
    venue: "Explanada Central",
    image: "https://images.unsplash.com/photo-1520075537983-6e046565a1bb?q=80&w=1200&auto=format&fit=crop",
    priceFrom: 180,
    available: false,
  },
];

export default function Home() {
  const onOpenEvent = (id: string) => {
    // Aquí luego navegas a /event/:id
    // navigate(`/event/${id}`);
    console.log("open event", id);
  };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1rem" }}>
      {/* Hero con carrusel */}
      <SimpleCarousel slides={slides} height={380} />

      {/* Sección destacados */}
      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Próximos eventos</h2>
          <a href="/events" style={{ color: "#0ea5e9", textDecoration: "none" }}>Ver todos</a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 16,
            marginTop: 12,
          }}
        >
          {mockEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev} onClick={onOpenEvent} />
          ))}
        </div>
      </section>
    </main>
  );
}
