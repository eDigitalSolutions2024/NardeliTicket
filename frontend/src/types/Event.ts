export interface TicketPricing {
  vip?: number;
  oro?: number;
}

export interface EventSession { id?: string; date: string; } // ISO
export type EventStatus = "draft" | "published";

export interface EventItem {
  id: string;
  title: string;
  venue: string;
  city: string;
  imageUrl: string;
  category?: "Conciertos" | "Teatro" | "Deportes" | "Familiares" | "Especiales";
  sessions: EventSession[];
  status?: EventStatus;
  featured?: boolean;
  pricing?: TicketPricing;
}
