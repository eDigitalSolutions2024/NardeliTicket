import { Link } from "react-router-dom";
import type { EventItem } from "../types/Event";
import "./EventTile.css";

const getNextDate = (ev: EventItem): Date | null => {
  const now = Date.now();
  const future = (ev.sessions ?? [])
    .map((s) => new Date(s.date).getTime())
    .filter((t) => t >= now)
    .sort((a, b) => a - b);
  return future[0] ? new Date(future[0]) : null;
};

export default function EventTile({ ev }: { ev: EventItem }) {
  const next = getNextDate(ev);

  return (
    <Link to={`/events/${ev.id}`} className="tile">
      <div className="tile__media">
        <img className="tile__blur" src={ev.imageUrl} alt="" aria-hidden />
        <img className="tile__img" src={ev.imageUrl} alt={ev.title} loading="lazy" />
        <div className="tile__scrim" />

        {ev.featured && <span className="tile__feat">★ Destacado</span>}
        {ev.category && <span className="tile__tag">{ev.category}</span>}

        <div className="tile__body">
          <span className="tile__meta">📍 {ev.city}</span>
          <h3 className="tile__title">{ev.title}</h3>
          <span className="tile__date">
            {next
              ? next.toLocaleDateString("es-MX", { day: "2-digit", month: "long" })
              : "Sin fechas próximas"}
          </span>
        </div>
      </div>
    </Link>
  );
}
