import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken } from "../api/client";

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

  // Rehidratación inicial: /me → si 401 → /auth/refresh → /me
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/auth/me");
        setUser(me.data.user ?? me.data);
      } catch {
        try {
          const r = await api.post("/auth/refresh");
          setAccessToken(r.data.accessToken);
          const me2 = await api.get("/auth/me");
          setUser(me2.data.user ?? me2.data);
        } catch {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // 👇 ESTE login es el que debe usar tu pantalla de login
  async function login(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    // backend puede responder {accessToken} o {token}
    setAccessToken(r.data.accessToken ?? r.data.token);
    setUser(r.data.user);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready]);
  return <CtxAuth.Provider value={value}>{children}</CtxAuth.Provider>;
}
