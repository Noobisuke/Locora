import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "./api";

type User = { id: string; name: string; email: string; role: string };
export type Pending = { email: string; resendIn?: number; devCode?: string };
type Ctx = {
  user: User | null; ready: boolean; login: (e: string, p: string) => Promise<void>;
  register: (n: string, e: string, p: string) => Promise<Pending>; // signup does NOT log in: the emailed code must be entered first
  verifyEmail: (e: string, code: string) => Promise<void>; resendCode: (e: string) => Promise<{ resendIn?: number; devCode?: string }>;
  logout: () => Promise<void>;
};
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
      register: (name, email, password) => api<Pending>("/auth/register", { method: "POST", body: { name, email, password } }),
      verifyEmail: async (email, code) => save(await api("/auth/verify-email", { method: "POST", body: { email, code } })),
      resendCode: (email) => api("/auth/resend-code", { method: "POST", body: { email } }),
      logout: async () => { await setToken(null); setUser(null); },
    }}>{children}</AuthCtx.Provider>
  );
}
