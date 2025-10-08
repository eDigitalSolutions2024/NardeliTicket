import { api } from "./client";

export type User = { id: string; name: string; email: string; role: "admin"|"user" };

export async function login(email: string, password: string) {
  const { data } = await api.post("/api/auth/login", { email, password });
  return data as { user: User; token: string };
}
export async function register(name: string, email: string, password: string) {
  const { data } = await api.post("/api/auth/register", { name, email, password });
  return data as { user: User; token: string };
}
export async function getMe() {
  const { data } = await api.get("/api/auth/me");
  return data as { user: User };
}
