import { api } from "./client";

export type Me = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  phone?: string;      // opcional
  avatarUrl?: string;  // opcional
};

// 👇 NUEVO
export type MyPurchase = {
  orderId: string;
  ticketId: string;
  eventId: string;
  eventTitle: string;
  sessionDate?: string | null;
  zone?: string;
  seatLabel?: string;
  price?: number;
  status: string;
  method?: string;
  createdAt?: string | null;
  paidAt?: string | null;
  pdfUrl?: string | null;
};

// GET /api/account/me
export async function fetchMe(): Promise<Me> {
  const r = await api.get("/account/me");
  return (r.data.user ?? r.data) as Me;
}

// PUT /api/account/profile
export async function updateProfile(payload: { name?: string; phone?: string }): Promise<Me> {
  const r = await api.put("/account/profile", payload);
  return (r.data.user ?? r.data) as Me;
}

// PUT /api/account/password
export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  await api.put("/account/password", payload);
  return { ok: true };
}

// 👇 NUEVO: GET /api/account/purchases
export async function fetchMyPurchases(): Promise<MyPurchase[]> {
  const r = await api.get("/account/purchases");
  return (r.data.rows ?? []) as MyPurchase[];
}
