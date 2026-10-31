import crypto from "crypto";
import { prisma } from "../db";
import { config } from "../config";
import { mailConfigured, sendMail } from "./mailer";

const TTL_MS = 10 * 60_000;       // a code is valid for 10 minutes
const COOLDOWN_MS = 60_000;       // at most one email per minute per address
const MAX_PER_HOUR = 5;           // ...and five per hour
const MAX_ATTEMPTS = 5;           // wrong guesses allowed per code

const hash = (email: string, code: string) => crypto.createHmac("sha256", config.JWT_SECRET).update(`${email}:${code}`).digest("hex");

export class MailUnavailable extends Error {}
export type Issued = { sent: boolean; waitSeconds?: number; devCode?: string };

/** Creates and emails a fresh 6-digit code. Returns sent:false (with a wait time) when rate-limited. */
export async function issueCode(email: string): Promise<Issued> {
  const live = mailConfigured();
  if (!live && config.NODE_ENV === "production") throw new MailUnavailable("Email service is not configured");
  const now = Date.now();
  await prisma.emailOtp.deleteMany({ where: { createdAt: { lt: new Date(now - 24 * 3600_000) } } }); // tidy old rows
  const last = await prisma.emailOtp.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (last && now - last.createdAt.getTime() < COOLDOWN_MS) return { sent: false, waitSeconds: Math.ceil((COOLDOWN_MS - (now - last.createdAt.getTime())) / 1000) };
  const lastHour = await prisma.emailOtp.count({ where: { email, createdAt: { gt: new Date(now - 3600_000) } } });
  if (lastHour >= MAX_PER_HOUR) return { sent: false, waitSeconds: 3600 };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await prisma.emailOtp.create({ data: { email, codeHash: hash(email, code), expiresAt: new Date(now + TTL_MS) } });
  if (!live) return { sent: true, devCode: code }; // local development only (blocked above in production)
  try {
    await sendMail(
      email, `${code} is your Locora verification code`,
      `Your Locora verification code is ${code}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
      `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px"><h2 style="color:#0f766e;margin:0 0 8px">Locora</h2><p>Your verification code is</p><p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:8px 0">${code}</p><p style="color:#64748b">It expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
    );
  } catch (e) {
    await prisma.emailOtp.delete({ where: { id: row.id } }).catch(() => {});
    console.error("verification email failed:", (e as Error).message);
    throw new MailUnavailable("Could not send the verification email");
  }
  return { sent: true };
}

export type Checked = { ok: true } | { ok: false; error: string };

/** Checks a code. Every guess uses up an attempt atomically, so parallel guessing cannot beat the limit. */
export async function verifyCode(email: string, code: string): Promise<Checked> {
  const rec = await prisma.emailOtp.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (!rec || rec.expiresAt < new Date()) return { ok: false, error: "That code has expired. Request a new one." };
  const used = await prisma.emailOtp.updateMany({ where: { id: rec.id, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (used.count === 0) return { ok: false, error: "Too many wrong attempts. Request a new code." };
  const a = Buffer.from(hash(email, code)), b = Buffer.from(rec.codeHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: "Incorrect code. Check it and try again." };
  await prisma.emailOtp.deleteMany({ where: { email } });
  return { ok: true };
}
