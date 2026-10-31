import { config } from "../config";

// Sends through Brevo's HTTP API (works on serverless hosts such as Vercel; no SMTP connection needed).
// Needs BREVO_API_KEY and MAIL_FROM_EMAIL (an address you have verified as a sender inside Brevo).
export const mailConfigured = (): boolean => Boolean(config.BREVO_API_KEY && config.MAIL_FROM_EMAIL);

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!mailConfigured()) throw new Error("No email provider is connected");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": config.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: config.MAIL_FROM_NAME, email: config.MAIL_FROM_EMAIL },
      to: [{ email: to }], subject, textContent: text, ...(html ? { htmlContent: html } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
