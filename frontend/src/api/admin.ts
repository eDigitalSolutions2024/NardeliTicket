// src/api/admin.ts
import { api } from "./client";

export type SalesQuery = {
  from?: string;
  to?: string;
  eventId?: string;
  status?: string;
  q?: string;
};

export type TicketSale = {
  ticketId: string;
  orderId: string;
  eventId: string;
  eventTitle: string;
  sessionDate?: string;
  zone?: string;
  seatNumber?: string;
  seatLabel?: string;
  price?: number;
  status: string;
  method?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  createdAt?: string;
  paidAt?: string;
};

export async function fetchSales(params: SalesQuery) {
  // si montaste app.use(adminSalesRoutes) => "/admin/sales"
  // si montaste app.use("/api", adminSalesRoutes) => "/api/admin/sales"
  const { data } = await api.get("/admin/sales", { params });
  return data as { rows: TicketSale[]; totalAmount: number };
}
