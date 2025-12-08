
import { useNavigate } from "react-router-dom";
import type { EventItem } from "../types/Event";

type Props = {
  ev: EventItem;
  onClick?: (id: string) => void;
  className?: string;
  buttonText?: string;
  hrefBase?: string; // opcional: por si tu detalle es /evento/:id en vez de /events/:id
};

// Próxima fecha futura (o null si no hay)
const getNextDate = (ev: EventItem): Date | null => {
  const now = Date.now();
  const future = (ev.sessions ?? [])
    .map((s) => new Date(s.date).getTime())
    .filter((t) => t >= now)
    .sort((a, b) => a - b);
  return future[0] ? new Date(future[0]) : null;
};

export default function EventCard({
  ev,
  onClick,
  className,
  hrefBase = "/events", // cámbialo a "/evento" si tu ruta es /evento/:id
}: Props) {
  const next = getNextDate(ev);
  const navigate = useNavigate();
  const handleClick = () => {navigate(`${hrefBase}/${ev.id}`)};


  return (
    <article
      className={`card card--clickable ${className ?? ""}`}
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div style={{ position: "relative" }}>
        {!next && <span className="card__badge--soldout">Agotado</span>}
        <img className="card__image" src={ev.imageUrl} alt={ev.title} loading="lazy" />
      </div>

      <div className="card__body">
        <h3 className="card__title">{ev.title}</h3>
        <p className="card__meta">
          {ev.venue} — {ev.city}
        </p>
        <p className="card__price">
          {next ? `Próx.: ${next.toLocaleString("es-MX")}` : "Sin fechas próximas"}
        </p>
      </div>
    </article>
  );
}
