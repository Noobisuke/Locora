// EMAIL IS NOT CONNECTED. This is the integration point for password reset emails.
// To connect: pick a provider (Resend, Brevo, SendGrid or SMTP via nodemailer), add its keys to .env,
// implement sendMail() below, and make mailConfigured() return true when the keys exist.
export const mailConfigured = (): boolean => false;
export async function sendMail(_to: string, _subject: string, _text: string): Promise<void> {
  throw new Error("No email provider is connected");
}
