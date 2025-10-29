// src/api/client.ts
import axios, { AxiosError } from "axios";

/**
 * API_ORIGIN: ej. http://localhost:4000
 * API_BASE:   ej. http://localhost:4000/api
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000";
export const API_BASE = `${API_ORIGIN.replace(/\/+$/, "")}/api`;

/**
 * Instancia principal de Axios para tu API.
 * - baseURL ya incluye /api
 * - withCredentials para enviar/recibir la cookie httpOnly del refresh
 */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 12000,
});

/* ============================================================
   Manejo de Access Token (solo en memoria)
   ============================================================ */
let accessToken: string | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/* ============================================================
   Request Interceptor: Adjunta Authorization si hay token
   ============================================================ */
api.interceptors.request.use((config) => {
  if (!config.headers) config.headers = {};
  if (accessToken) {
    (config.headers as any).Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/* ============================================================
   Refresh control (evita condiciones de carrera)
   ============================================================ */
let isRefreshing = false;
let waitQueue: Array<() => void> = [];

function pushWaiter(resolve: () => void) {
  waitQueue.push(resolve);
}

function flushWaiters() {
  waitQueue.forEach((fn) => fn());
  waitQueue = [];
}

/**
 * Llama al endpoint de refresh usando axios "crudo" (sin interceptores)
 * para evitar bucles si /auth/refresh devuelve 401.
 */
async function refreshAccessToken(): Promise<string> {
  const resp = await axios.post(
    `${API_BASE}/auth/refresh`,
    null,
    { withCredentials: true, timeout: 12000 }
  );
  const newToken = (resp.data as any)?.accessToken;
  if (!newToken) {
    throw new Error("No se recibió accessToken en refresh");
  }
  setAccessToken(newToken);
  return newToken;
}

/* ============================================================
   Response Interceptor: Reintenta una vez tras refresh (401)
   ============================================================ */
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original: any = error.config || {};
    const status = error.response?.status ?? 0;

    // Evita interceptar la propia llamada a /auth/refresh
    const isRefreshCall = String(original?.url || "").includes("/auth/refresh");

    if (status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;

      if (isRefreshing) {
        // Espera a que termine el refresh en curso
        await new Promise<void>((resolve) => pushWaiter(resolve));
      } else {
        // Inicia refresh
        isRefreshing = true;
        try {
          await refreshAccessToken();
          flushWaiters();
        } catch (e) {
          // Refresh falló: limpiamos token y propagamos
          setAccessToken(null);
          isRefreshing = false;
          throw e;
        }
        isRefreshing = false;
      }

      // Reintenta la request original con el nuevo token
      return api(original);
    }

    // Cualquier otro error, lo propagamos
    throw error;
  }
);

/* ============================================================
   Helper opcional: intentar sesión silenciosa al arrancar la app
   Llama esto en tu layout raíz (useEffect) si quieres “autologin”.
   ============================================================ */
export async function bootstrapSessionSilently(): Promise<void> {
  try {
    await refreshAccessToken();
  } catch {
    // Silencioso: no hay sesión o expiró el refresh; el usuario seguirá como "no autenticado"
  }
}

/* ============================================================
   Helper opcional: logout
   ============================================================ */
export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout"); // tu endpoint debe borrar cookie refresh
  } finally {
    setAccessToken(null);
  }
}
