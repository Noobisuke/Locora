import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { verifyCheckoutSignature, verifyWebhookSignature } from "../lib/razorpaySig";

export const razorpayConfigured = () => !!(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);
export const paymentRouter = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

// Public: tells the frontend whether online payment is available. KEY_ID is public by design; the SECRET never leaves the server.
paymentRouter.get("/config", (_req, res) => {
  res.json({ onlineEnabled: razorpayConfigured(), keyId: razorpayConfigured() ? config.RAZORPAY_KEY_ID : null });
});

// Step 1: create a Razorpay order. The amount comes from OUR database, never from the client.
paymentRouter.post("/razorpay/create", requireAuth, limiter, async (req, res) => {
  const p = z.object({ orderId: z.string().min(1) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  if (!razorpayConfigured()) return res.status(503).json({ error: "Online payment is not configured on this server" });
  const find = () => prisma.payment.findFirst({ where: { orderId: p.data.orderId, method: "ONLINE", order: { userId: req.user!.id, status: "PENDING" } } });
  let payment = await find();
  if (!payment) return res.status(404).json({ error: "No payable online order found" });
  if (payment.status !== "PENDING") return res.status(409).json({ error: "This order is already paid" });

  if (!payment.providerOrderId) {
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString("base64") },
      body: JSON.stringify({ amount: payment.amountPaise, currency: "INR", receipt: payment.orderId, notes: { orderId: payment.orderId } }),
    }).catch(() => null);
    if (!r || !r.ok) { console.error("Razorpay order creation failed, HTTP", r?.status); return res.status(502).json({ error: "Payment provider is unavailable. Try again." }); }
    const rp = (await r.json()) as { id: string };
    // Only the first concurrent request stores its id; a loser re-reads the winner's.
    await prisma.payment.updateMany({ where: { id: payment.id, providerOrderId: null }, data: { providerOrderId: rp.id } });
    payment = await find();
    if (!payment?.providerOrderId) return res.status(500).json({ error: "Could not start payment" });
  }
  res.json({ keyId: config.RAZORPAY_KEY_ID, razorpayOrderId: payment.providerOrderId, amountPaise: payment.amountPaise, currency: "INR" });
});

// Shared by verify + webhook. Idempotent: only a PENDING payment can become SUCCESS, exactly once.
async function markSuccess(providerOrderId: string, providerPaymentId: string, amountPaise?: number): Promise<"updated" | "already" | "unknown" | "amount_mismatch"> {
  const pay = await prisma.payment.findUnique({ where: { providerOrderId }, include: { order: { select: { status: true } } } });
  if (!pay) return "unknown";
  if (amountPaise !== undefined && amountPaise !== pay.amountPaise) return "amount_mismatch";
  try {
    const r = await prisma.payment.updateMany({ where: { id: pay.id, status: "PENDING" }, data: { status: "SUCCESS", providerPaymentId } });
    if (r.count === 0) return "already";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "already";
    throw e;
  }
  if (pay.order.status === "CANCELLED") console.warn(`PAID_BUT_ORDER_CANCELLED order=${pay.orderId} payment=${providerPaymentId} -> manual refund needed`);
  return "updated";
}

// Step 2: browser reports success; we verify the signature on the server before trusting it.
const verifySchema = z.object({ razorpay_order_id: z.string().min(1), razorpay_payment_id: z.string().min(1), razorpay_signature: z.string().min(1) });
paymentRouter.post("/razorpay/verify", requireAuth, limiter, async (req, res) => {
  const p = verifySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  if (!razorpayConfigured()) return res.status(503).json({ error: "Online payment is not configured on this server" });
  const mine = await prisma.payment.findFirst({ where: { providerOrderId: p.data.razorpay_order_id, order: { userId: req.user!.id } } });
  if (!mine) return res.status(404).json({ error: "Payment not found" });
  if (!verifyCheckoutSignature(p.data.razorpay_order_id, p.data.razorpay_payment_id, p.data.razorpay_signature, config.RAZORPAY_KEY_SECRET!))
    return res.status(400).json({ error: "Payment signature is invalid" });
  const result = await markSuccess(p.data.razorpay_order_id, p.data.razorpay_payment_id);
  res.json({ status: "SUCCESS", processed: result });
});

// Webhook: needs the RAW body to check the signature, so index.ts mounts this before express.json().
export async function razorpayWebhook(req: Request, res: Response) {
  if (!config.RAZORPAY_WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook not configured" });
  const raw = req.body as Buffer;
  const sig = req.headers["x-razorpay-signature"];
  if (!Buffer.isBuffer(raw) || typeof sig !== "string" || !verifyWebhookSignature(raw, sig, config.RAZORPAY_WEBHOOK_SECRET))
    return res.status(400).json({ error: "Invalid signature" });
  let evt: { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number } }; refund?: { entity?: { payment_id: string } } } };
  try { evt = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ error: "Invalid body" }); }

  if (evt.event === "payment.captured" || evt.event === "order.paid") {
    const e = evt.payload?.payment?.entity;
    if (e?.order_id && e.id) {
      const r = await markSuccess(e.order_id, e.id, e.amount);
      if (r === "amount_mismatch") console.error("Webhook amount mismatch for", e.order_id);
    }
  } else if (evt.event === "refund.processed") {
    const pid = evt.payload?.refund?.entity?.payment_id;
    if (pid) await prisma.payment.updateMany({ where: { providerPaymentId: pid, status: "SUCCESS" }, data: { status: "REFUNDED" } });
  }
  // payment.failed is intentionally ignored: Razorpay lets the customer retry the same order, so we keep it PENDING.
  res.json({ received: true }); // 200 for handled and ignored events so Razorpay does not retry forever
}
