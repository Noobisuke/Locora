import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "./api";

type User = { id: string; name: string; email: string; role: string };
type Ctx = { user: User | null; ready: boolean; login: (e: string, p: string) => Promise<void>; register: (n: string, e: string, p: string) => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try { if (await loadToken()) setUser((await api<{ user: User | null }>("/auth/me")).user); }
      catch { await setToken(null); } finally { setReady(true); }
    })();
  }, []);
  const save = async (r: { token: string; user: User }) => { await setToken(r.token); setUser(r.user); };
  return (
    <AuthCtx.Provider value={{
      user, ready,
      login: async (email, password) => save(await api("/auth/login", { method: "POST", body: { email, password } })),
      register: async (name, email, password) => save(await api("/auth/register", { method: "POST", body: { name, email, password } })),
      logout: async () => { await setToken(null); setUser(null); },
    }}>{children}</AuthCtx.Provider>
  );
}
