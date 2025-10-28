// src/api/auth.ts
import { api } from "./client";

export type User = { id: string; name: string; email: string; role: "admin" | "user" };

// La API puede devolver accessToken (nuevo) o token (legacy) — soporta ambos
export type AuthResponse = { user: User; accessToken?: string; token?: string };

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
  return data; // { user, accessToken? , token? }
}

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/register", { name, email, password });
  return data; // { user, accessToken? , token? }
}

export async function getMe() {
  const { data } = await api.get<{ user: User } | User>("/auth/me");
  // /me puede responder { user } o directamente el user (según tu controller); normaliza:
  const user = (data as any)?.user ?? data;
  return { user: user as User };
}

// 👇 Necesarios para el flujo de sesión persistente
export async function refresh() {
  const { data } = await api.post<{ accessToken: string }>("/auth/refresh");
  return data; // { accessToken }
}

export async function logout() {
  const { data } = await api.post<{ ok: boolean }>("/auth/logout");
  return data;
}
