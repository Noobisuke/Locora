import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { mailConfigured, sendMail } from "../lib/mailer";
import { checkEmailDomain } from "../lib/emailCheck";
import { issueCode, MailUnavailable, verifyCode } from "../lib/otp";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/).optional(),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const sign = (id: string) =>
  jwt.sign({ sub: id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
const publicUser = (u: { id: string; name: string; email: string; role: string; phone: string | null }) =>
  ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone });

const emailOnly = z.object({ email: z.string().trim().toLowerCase().email() });

// Role is NEVER taken from the request body: public signup always creates a CUSTOMER.
// Signup does NOT log the person in: they must first prove they own the address with a 6-digit emailed code.
authRouter.post("/register", async (req, res) => {
  const p = registerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  if (mailConfigured()) { // real provider connected: reject made-up and throwaway domains before sending anything
    const verdict = await checkEmailDomain(p.data.email);
    if (!verdict.ok) return res.status(400).json({ error: verdict.reason, details: { email: [verdict.reason] } });
  }
  const exists = await prisma.user.findUnique({ where: { email: p.data.email } });
  if (exists?.emailVerifiedAt) return res.status(409).json({ error: "Email already registered. Please log in." });
  const passwordHash = await bcrypt.hash(p.data.password, 12);
  // An earlier unverified attempt just gets replaced: that account could never log in anyway.
  if (exists) await prisma.user.update({ where: { id: exists.id }, data: { name: p.data.name, phone: p.data.phone, passwordHash } });
  else await prisma.user.create({ data: { name: p.data.name, email: p.data.email, phone: p.data.phone, passwordHash } });
  try {
    const r = await issueCode(p.data.email);
    res.status(201).json({ verificationRequired: true, email: p.data.email, resendIn: r.waitSeconds ?? 60, ...(r.devCode ? { devCode: r.devCode } : {}) });
  } catch (e) {
    if (e instanceof MailUnavailable) return res.status(503).json({ error: "We could not send the verification email right now. Please try again shortly." });
    throw e;
  }
});

authRouter.post("/verify-email", async (req, res) => {
  const p = z.object({ email: z.string().trim().toLowerCase().email(), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const user = await prisma.user.findUnique({ where: { email: p.data.email } });
  if (!user || !user.isActive) return res.status(400).json({ error: "Incorrect code. Check it and try again." }); // same answer: no account enumeration
  if (user.emailVerifiedAt) return res.status(409).json({ error: "This email is already verified. Please log in." });
  const v = await verifyCode(p.data.email, p.data.code);
  if (!v.ok) return res.status(400).json({ error: v.error });
  const verified = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  res.json({ token: sign(verified.id), user: publicUser(verified) });
});

authRouter.post("/resend-code", async (req, res) => {
  const p = emailOnly.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const user = await prisma.user.findUnique({ where: { email: p.data.email } });
  let out: { resendIn?: number; devCode?: string } = {};
  if (user && user.isActive && !user.emailVerifiedAt) {
    try { const r = await issueCode(user.email); out = { resendIn: r.waitSeconds, ...(r.devCode ? { devCode: r.devCode } : {}) }; }
    catch (e) { if (e instanceof MailUnavailable) return res.status(503).json({ error: "We could not send the email right now. Please try again shortly." }); throw e; }
  }
  res.json({ message: "If that account is waiting for verification, a new code has been sent.", ...out }); // same answer either way
});

authRouter.post("/login", async (req, res) => {
  const p = loginSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const user = await prisma.user.findUnique({ where: { email: p.data.email } });
  const ok = user && user.isActive && (await bcrypt.compare(p.data.password, user.passwordHash));
  if (!user || !ok) return res.status(401).json({ error: "Incorrect email or password" });
  if (!user.emailVerifiedAt) { // right password, but the address was never verified: send a fresh code and say so
    let extra: { resendIn?: number; devCode?: string } = {};
    try { const r = await issueCode(user.email); extra = { resendIn: r.waitSeconds, ...(r.devCode ? { devCode: r.devCode } : {}) }; } catch (e) { console.error("login code failed:", (e as Error).message); }
    return res.status(403).json({ error: "Please verify your email to continue.", code: "EMAIL_NOT_VERIFIED", email: user.email, ...extra });
  }
  res.json({ token: sign(user.id), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  res.json({ user: user ? publicUser(user) : null });
});

// ---- Password reset (structure ready; needs an email provider, see lib/mailer.ts) ----
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

authRouter.post("/forgot-password", async (req, res) => {
  const p = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  if (!mailConfigured()) return res.status(503).json({ error: "Password reset by email is not configured on this server yet" });
  const user = await prisma.user.findUnique({ where: { email: p.data.email } });
  if (user && user.isActive) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });
    const base = config.CORS_ORIGINS.split(",")[0].trim();
    await sendMail(user.email, "Reset your Locora password", `Use this link within 30 minutes: ${base}/reset-password?token=${token}`).catch((e) => console.error("mail failed", e.message));
  }
  res.json({ message: "If that email is registered, a reset link has been sent" }); // same answer either way: no account enumeration
});

authRouter.post("/reset-password", async (req, res) => {
  const p = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(100) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha(p.data.token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return res.status(400).json({ error: "Reset link is invalid or expired" });
  const hash = await bcrypt.hash(p.data.password, 12);
  const ok = await prisma.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } }); // one-time use, race-safe
    if (used.count === 0) return false;
    await tx.user.update({ where: { id: rec.userId }, data: { passwordHash: hash } });
    await tx.passwordResetToken.updateMany({ where: { userId: rec.userId, usedAt: null }, data: { usedAt: new Date() } });
    return true;
  });
  if (!ok) return res.status(400).json({ error: "Reset link is invalid or expired" });
  res.json({ message: "Password updated. You can log in now." });
});
