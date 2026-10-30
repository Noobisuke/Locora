import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { mailConfigured, sendMail } from "../lib/mailer";

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

// Role is NEVER taken from the request body: public signup always creates a CUSTOMER.
authRouter.post("/register", async (req, res) => {
  const p = registerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input", details: p.error.flatten().fieldErrors });
  const exists = await prisma.user.findUnique({ where: { email: p.data.email } });
  if (exists) return res.status(409).json({ error: "Email already registered" });
  const user = await prisma.user.create({
    data: { name: p.data.name, email: p.data.email, phone: p.data.phone, passwordHash: await bcrypt.hash(p.data.password, 12) },
  });
  res.status(201).json({ token: sign(user.id), user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const p = loginSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const user = await prisma.user.findUnique({ where: { email: p.data.email } });
  const ok = user && user.isActive && (await bcrypt.compare(p.data.password, user.passwordHash));
  if (!user || !ok) return res.status(401).json({ error: "Incorrect email or password" });
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
