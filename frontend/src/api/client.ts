import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  timeout: 8000,
});

export const API_ORIGIN: string =
  (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000";

export const API_BASE: string = `${API_ORIGIN}/api`;

// Adjunta Authorization si hay token en localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});
