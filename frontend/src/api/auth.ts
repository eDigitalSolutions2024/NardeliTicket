// src/api/auth.ts (frontend)
import { api } from "./client";
import { setAccessToken } from "./client";

export type User = { id: string; name: string; email: string; role: "admin" | "user" };
export type AuthResponse = { user: User; accessToken?: string; token?: string };

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
  const at = data.accessToken || data.token || null;
  setAccessToken(at);
  return data; // { user, accessToken?, token? }
}

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/register", { name, email, password });
  const at = data.accessToken || data.token || null;
  setAccessToken(at);
  return data;
}

export async function getMe() {
  const { data } = await api.get<{ user: User } | User>("/auth/me");
  const user = (data as any)?.user ?? data;
  return { user: user as User };
}

export async function refresh() {
  const { data } = await api.post<{ accessToken: string }>("/auth/refresh");
  setAccessToken(data?.accessToken || null);
  return data;
}

export async function logout() {
  try {
    await api.post<{ ok: boolean }>("/auth/logout");
  } finally {
    setAccessToken(null);
  }
}
