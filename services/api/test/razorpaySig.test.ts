import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyCheckoutSignature, verifyWebhookSignature } from "../src/lib/razorpaySig.ts";

const sig = (secret: string, data: string | Buffer) => crypto.createHmac("sha256", secret).update(data).digest("hex");

test("valid checkout signature is accepted", () => {
  assert.equal(verifyCheckoutSignature("order_A1", "pay_B2", sig("sec", "order_A1|pay_B2"), "sec"), true);
});
test("tampered payment id is rejected", () => {
  assert.equal(verifyCheckoutSignature("order_A1", "pay_EVIL", sig("sec", "order_A1|pay_B2"), "sec"), false);
});
test("wrong secret is rejected", () => {
  assert.equal(verifyCheckoutSignature("order_A1", "pay_B2", sig("other", "order_A1|pay_B2"), "sec"), false);
});
test("empty / short / missing signatures are rejected", () => {
  assert.equal(verifyCheckoutSignature("o", "p", "", "sec"), false);
  assert.equal(verifyCheckoutSignature("o", "p", "abc", "sec"), false);
  assert.equal(verifyCheckoutSignature("o", "p", undefined as unknown as string, "sec"), false);
});
test("webhook signature over raw body", () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  assert.equal(verifyWebhookSignature(body, sig("wh", body), "wh"), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"payment.captured" }'), sig("wh", body), "wh"), false);
});
