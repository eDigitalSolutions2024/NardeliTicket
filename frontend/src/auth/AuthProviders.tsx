import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, bootstrapSessionSilently, setAccessToken } from "../api/client";

type Role = "admin" | "user" | "asistente" | string;

export type User = {
  id: string;
  name?: string;
  email?: string;
  role?: Role;
  phone?: string;
  avatarUrl?: string;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const CtxAuth = createContext<Ctx>(null as any);
export const useAuth = () => useContext(CtxAuth);

// Normaliza respuesta del backend: usa id o _id
function normalizeUser(u: any): User {
  if (!u) return null as any;
  const { _id, id, ...rest } = u;
  return { id: id ?? _id, ...rest };
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Rehidratación inicial (refresh silencioso + /auth/me)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await bootstrapSessionSilently();
        const me = await api.get("/auth/me");
        if (alive) setUser(normalizeUser(me.data.user ?? me.data));
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
  }, []);

  // Expone un refresh explícito (útil tras editar perfil)
  async function refreshMe() {
    try {
      const me = await api.get("/auth/me");
      setUser(normalizeUser(me.data.user ?? me.data));
    } catch {
      setUser(null);
    }
  }

  // Login oficial
  async function login(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    setAccessToken(r.data.accessToken ?? r.data.token ?? null);
    await refreshMe();
  }

  // Logout
  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  const value = useMemo(() => ({ user, ready, login, logout, refreshMe }), [user, ready]);
  return <CtxAuth.Provider value={value}>{children}</CtxAuth.Provider>;
}
