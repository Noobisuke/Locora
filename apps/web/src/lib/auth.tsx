"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, TOKEN_KEY } from "./api";

type User = { id: string; name: string; email: string; role: string };
type Ctx = { user: User | null; ready: boolean; login: (e: string, p: string) => Promise<void>; register: (n: string, e: string, p: string) => Promise<void>; logout: () => void; refresh: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

// NOTE: the token is kept in localStorage for MVP simplicity. For production, prefer an httpOnly cookie (see README).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setReady(true); return; }
    api<{ user: User | null }>("/auth/me").then((r) => setUser(r.user)).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setReady(true));
  }, []);
  const refresh = async () => { try { setUser((await api<{ user: User | null }>("/auth/me")).user); } catch { /* keep current user */ } };
  useEffect(() => {
    const onExpired = () => { localStorage.removeItem(TOKEN_KEY); setUser(null); };
    window.addEventListener("locora:unauthorized", onExpired);
    return () => window.removeEventListener("locora:unauthorized", onExpired);
  }, []);
  const save = (r: { token: string; user: User }) => { localStorage.setItem(TOKEN_KEY, r.token); setUser(r.user); };
  return (
    <AuthCtx.Provider value={{
      user, ready, refresh,
      login: async (email, password) => save(await api("/auth/login", { method: "POST", body: { email, password } })),
      register: async (name, email, password) => save(await api("/auth/register", { method: "POST", body: { name, email, password } })),
      logout: () => { localStorage.removeItem(TOKEN_KEY); setUser(null); },
    }}>{children}</AuthCtx.Provider>
  );
}
