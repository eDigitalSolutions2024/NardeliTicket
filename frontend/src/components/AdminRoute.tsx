import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, bootstrapSessionSilently, setAccessToken } from "../api/client";

type User = { id: string; name?: string; email?: string; role?: string };

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const CtxAuth = createContext<Ctx>(null as any);
export const useAuth = () => useContext(CtxAuth);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Rehidratación inicial (una sola vez):
  // 1) intenta refresh silencioso (usa cookie httpOnly)
  // 2) si ok, llama /auth/me; si falla, queda sin sesión (user=null)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await bootstrapSessionSilently();           // ← usa axios "crudo" dentro de client.ts
        const me = await api.get("/auth/me");       // ← ya hay accessToken en memoria si lo anterior fue ok
        if (alive) setUser(me.data.user ?? me.data);
      } catch {
        if (alive) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []); // 👈 dependencias vacías para evitar loops

  // Login "oficial" para la pantalla de login
  async function login(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    // backend puede responder {accessToken} o {token}
    setAccessToken(r.data.accessToken ?? r.data.token ?? null);
    const me = await api.get("/auth/me");  // ya con Authorization
    setUser(me.data.user ?? me.data);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready]);
  return <CtxAuth.Provider value={value}>{children}</CtxAuth.Provider>;
}
