import { create } from "zustand";
import type { User } from "../api/auth";

type State = {
  user?: User;
  token?: string;
  setAuth: (u: User, t: string) => void;
  logout: () => void;
  hydrate: () => void;
};

export const useAuth = create<State>((set) => ({
  user: undefined,
  token: undefined,
  setAuth: (user, token) => {
    localStorage.setItem("token", token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ user: undefined, token: undefined });
  },
  hydrate: () => {
    const token = localStorage.getItem("token") || undefined;
    set({ token }); // opcional: podrías llamar getMe aquí
  }
}));
