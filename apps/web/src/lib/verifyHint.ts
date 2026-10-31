// Remembers (for this browser tab only) when the last code was sent, so the verify page can show a resend countdown.
// In local development without an email provider the API also returns the code itself as `devCode`.
const KEY = "locora_verify_hint";
export type Hint = { email: string; devCode?: string; resendAt: number };

export function saveHint(h: { email: string; devCode?: string; resendIn?: number }) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ email: h.email, devCode: h.devCode, resendAt: Date.now() + (h.resendIn ?? 60) * 1000 })); } catch { /* private mode: fine */ }
}
export function readHint(email: string): Hint | null {
  try { const h = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Hint | null; return h && h.email === email ? h : null; } catch { return null; }
}
