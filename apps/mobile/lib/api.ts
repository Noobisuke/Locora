import * as SecureStore from "expo-secure-store";

// 10.0.2.2 reaches the PC from the Android EMULATOR. A physical phone needs your PC's LAN IP (see .env.example).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000/api";
let token: string | null = null;

export async function loadToken() { token = await SecureStore.getItemAsync("locora_token"); return token; }
export async function setToken(t: string | null) {
  token = t;
  if (t) await SecureStore.setItemAsync("locora_token", t); else await SecureStore.deleteItemAsync("locora_token");
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch { throw new Error("Cannot reach the server. Check Wi-Fi and the API address."); }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}
