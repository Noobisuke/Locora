// Remembers (in memory) when the last code was sent so the verify screen can show a resend countdown.
// In local development without an email provider the API also returns the code itself as `devCode`.
let hint: { email: string; devCode?: string; resendAt: number } | null = null;
export const setHint = (h: { email: string; devCode?: string; resendIn?: number }) => { hint = { email: h.email, devCode: h.devCode, resendAt: Date.now() + (h.resendIn ?? 60) * 1000 }; };
export const getHint = (email: string) => (hint && hint.email === email ? hint : null);
