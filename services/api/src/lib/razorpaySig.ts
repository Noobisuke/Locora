import crypto from "node:crypto";

const hmacHex = (secret: string, data: string | Buffer): string => crypto.createHmac("sha256", secret).update(data).digest("hex");

// Constant-time comparison; false for missing or different-length input.
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a ?? "", "utf8");
  const y = Buffer.from(b ?? "", "utf8");
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// Checkout success signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  return safeEqualHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

// Webhook signature = HMAC_SHA256(raw request body, WEBHOOK_SECRET)
export function verifyWebhookSignature(rawBody: Buffer, signature: string, webhookSecret: string): boolean {
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}
