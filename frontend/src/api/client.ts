// src/api/client.ts
import axios from "axios";

const API_ORIGIN = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000";
export const API_BASE = `${API_ORIGIN}/api`;

// === instancia axios apuntando a /api y con cookies ===
export const api = axios.create({
  baseURL: API_BASE,          // ← ya incluye /api
  withCredentials: true,      // ← NECESARIO para cookie httpOnly (refresh)
  timeout: 8000,
});

// ---- Manejo de accessToken (memoria + localStorage) ----
let accessToken: string | null =
  localStorage.getItem("accessToken") || localStorage.getItem("token"); // compat con tu clave anterior

export function setAccessToken(t: string | null) {
  accessToken = t;
  if (t) {
    localStorage.setItem("accessToken", t);
    // mantener compat (si tienes código viejo leyendo "token")
    localStorage.setItem("token", t);
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
  }
}

// Adjunta Authorization si hay accessToken
api.interceptors.request.use((config) => {
  if (!config.headers) config.headers = {};
  if (accessToken) (config.headers as any).Authorization = `Bearer ${accessToken}`;
  return config;
});

// ---- Interceptor 401: intenta refresh una vez y reintenta la request original ----
let isRefreshing = false;
let queue: Array<() => void> = [];
const flushQueue = () => { queue.forEach((fn) => fn()); queue = []; };

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error?.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        await new Promise<void>((resolve) => queue.push(resolve));
      } else {
        isRefreshing = true;
        try {
          // baseURL ya es /api → aquí usamos ruta relativa
          const r = await api.post("/auth/refresh");
          setAccessToken(r.data.accessToken);
          flushQueue();
        } catch (e) {
          setAccessToken(null);
          isRefreshing = false;
          throw e;
        }
        isRefreshing = false;
      }
      return api(original); // reintenta con el nuevo token
    }
    throw error;
  }
);
