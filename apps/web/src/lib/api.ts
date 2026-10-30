export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
export const TOKEN_KEY = "locora_token";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the Locora API running?");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && typeof window !== "undefined") window.dispatchEvent(new Event("locora:unauthorized"));
  if (!res.ok) throw new ApiError(res.status, apiMessage(data));
  return data as T;
}

// Turns the server's {error, details:{field:[msgs]}} into one readable sentence.
export function apiMessage(data: { error?: string; details?: Record<string, string[] | undefined> }): string {
  const first = data.details ? Object.entries(data.details).find(([, m]) => m && m.length) : undefined;
  if (first) return `${first[0]}: ${first[1]![0]}`;
  return data.error ?? "Something went wrong";
}

export type Product = {
  id: string; name: string; description: string; pricePaise: number; originalPricePaise: number | null; stock: number;
  images: { id: string; url: string }[]; store: { id: string; name: string }; category: { name: string; slug: string };
};
export type CartData = {
  items: { productId: string; name: string; image: string | null; store: { name: string }; unitPricePaise: number; quantity: number; stock: number; problem: string | null; linePaise: number }[];
  subtotalPaise: number; deliveryFeePaise: number; totalPaise: number;
};
export type Address = { id: string; label: string; line1: string; line2: string | null; city: string; state: string; pincode: string; phone: string; isDefault: boolean };
export type Order = {
  id: string; status: string; subtotalPaise: number; deliveryFeePaise: number; totalPaise: number; createdAt: string;
  items: { id: string; productId: string; productName: string; unitPricePaise: number; quantity: number }[];
  payments: { method: string; status: string }[]; address: Address;
  fulfillments: { id: string; status: string; store: { name: string }; delivery: { status: string } | null }[];
};

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const fd = new FormData();
  fd.append("image", file);
  let res: Response;
  try { res = await fetch(`${API_URL}${path}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd }); }
  catch { throw new ApiError(0, "Cannot reach the server."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Upload failed");
  return data as T;
}
