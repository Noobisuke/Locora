import test from "node:test";
import assert from "node:assert/strict";
import { checkEmailDomain, isDisposable } from "../src/lib/emailCheck.ts";

test("blocks well-known disposable domains and their subdomains", () => {
  assert.equal(isDisposable("mailinator.com"), true);
  assert.equal(isDisposable("MAILINATOR.com"), true);
  assert.equal(isDisposable("foo.mailinator.com"), true);
});
test("allows normal providers", () => {
  for (const d of ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "proton.me", "mycompany.in"]) assert.equal(isDisposable(d), false, d);
});
test("rejects malformed addresses without any network call", async () => {
  assert.deepEqual((await checkEmailDomain("nobody@localhost")).ok, false);
  const r = await checkEmailDomain("x@mailinator.com");
  assert.equal(r.ok, false);
});
