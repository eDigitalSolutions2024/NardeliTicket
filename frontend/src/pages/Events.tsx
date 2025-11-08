// src/pages/Events.tsx
import  { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchEvents } from "../api/events";
import type { EventItem } from "../types/Event";
import EventCard from "../components/EventCard";
import "../CSS/Home.css"; // reuse de grillas/clases básicas si ya las tienes

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name) || "", [search, name]);
}

// próxima fecha futura (timestamp) o null
const getNextDate = (ev: EventItem) => {
  const now = Date.now();
  const future = (ev.sessions ?? [])
    .map((s) => new Date(s.date).getTime())
    .filter((t) => t >= now)
    .sort((a, b) => a - b);
  return future[0] ?? null;
};

const CATEGORY_ORDER = [
  "Conciertos",
  "Teatro",
  "Deportes",
  "Familiares",
  "Especiales",
  "Otros",
] as const;

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const q = useQueryParam("q").trim().toLowerCase();

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

  // filtra publicados y por query del navbar
  const filtered = useMemo(() => {
    return events
      .filter((e) => e.status === "published")
      .filter((e) => {
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q)
        );
      });
  }, [events, q]);

  // agrupa por categoría, ordena cada grupo por próxima fecha
  const grouped = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of filtered) {
      const cat = ev.category || "Otros";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ev);
    }
    for (const [, list] of map.entries()) {
      list.sort((a, b) => {
        const an = getNextDate(a) ?? Number.MAX_SAFE_INTEGER;
        const bn = getNextDate(b) ?? Number.MAX_SAFE_INTEGER;
        return an - bn;
      });
    }
    // retorna en orden de categorías definido arriba
    const ordered: Array<{ category: string; items: EventItem[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      const items = map.get(cat as string);
      if (items && items.length) ordered.push({ category: cat as string, items });
    }
    // categorías no contempladas explícitamente (por si acaso)
    for (const [cat, items] of map.entries()) {
      if (!CATEGORY_ORDER.includes(cat as any)) {
        ordered.push({ category: cat, items });
      }
    }
    return ordered;
  }, [filtered]);

  const onOpenEvent = (id: string) => {
    // más adelante: navigate(`/evento/${id}`)
    console.log("open event", id);
  };

  return (
    <main className="u-container" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <h1 style={{ margin: "8px 0 16px 0" }}>Eventos</h1>
      {q && (
        <p style={{ marginTop: -6, color: "#64748b" }}>
          Resultados para: <strong>{q}</strong>
        </p>
      )}

      {loading ? (
        <p className="u-mt-16">Cargando...</p>
      ) : grouped.length === 0 ? (
        <p className="u-mt-16">No hay eventos para mostrar.</p>
      ) : (
        grouped.map(({ category, items }) => (
          <section key={category} className="home__section" style={{ marginTop: 24 }}>
            <div className="events__header u-flex-between">
              <h2 style={{ margin: 0 }}>{category}</h2>
            </div>
            <div className="events__grid">
              {items.map((ev) => (
                <EventCard
                  key={ev.id}
                  ev={ev}
                  onClick={onOpenEvent}
                  className="card card--clickable"
                />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
