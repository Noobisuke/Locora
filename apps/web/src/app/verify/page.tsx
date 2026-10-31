"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { readHint, saveHint } from "@/lib/verifyHint";

const mask = (e: string) => { const [u, d] = e.split("@"); return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`; };

function Form() {
  const { verifyEmail, resendCode } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const email = (sp.get("email") ?? "").toLowerCase();
  const next = sp.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(""); const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [left, setLeft] = useState(0); // seconds until "resend" is allowed again

  useEffect(() => {
    const h = readHint(email);
    if (h) { setDevCode(h.devCode); setLeft(Math.max(0, Math.ceil((h.resendAt - Date.now()) / 1000))); }
    input.current?.focus();
  }, [email]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function submit(c: string) {
    if (busy || c.length !== 6) return;
    setBusy(true); setError(""); setInfo("");
    try { await verifyEmail(email, c); router.replace(safeNext); }
    catch (e) { setError((e as Error).message); setBusy(false); setCode(""); input.current?.focus(); }
  }
  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submit(digits); // submits by itself once all 6 digits are in
  }
  async function resend() {
    setError(""); setInfo("");
    try {
      const r = await resendCode(email);
      saveHint({ email, devCode: r.devCode, resendIn: r.resendIn });
      setDevCode(r.devCode); setLeft(r.resendIn ?? 60);
      setInfo(r.resendIn ? `Please wait ${r.resendIn}s before asking for another code.` : "A new code has been sent.");
    } catch (e) { setError((e as Error).message); }
  }

  if (!email) return <div className="panel stack narrow"><h1 style={{ margin: 0 }}>Verify your email</h1><p className="muted">Start by creating an account.</p><Link className="btn" href="/register">Create account</Link></div>;
  return (
    <form className="panel stack narrow" onSubmit={(e) => { e.preventDefault(); submit(code); }}>
      <h1 style={{ margin: 0 }}>Check your email</h1>
      <p className="muted" style={{ margin: 0 }}>We sent a 6-digit code to <strong>{mask(email)}</strong>. It expires in 10 minutes. Not there? Check your spam folder.</p>
      {devCode && <div className="notice warn" role="status">Development mode: no email service is connected, so no email was sent. Your code is <strong>{devCode}</strong>. <button type="button" className="btn link" onClick={() => onChange(devCode)}>Use it</button></div>}
      {error && <div className="error" role="alert">{error}</div>}
      {info && <div className="notice ok" role="status">{info}</div>}
      <label htmlFor="code">Verification code</label>
      <input id="code" ref={input} value={code} onChange={(e) => onChange(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" aria-describedby="hint"
        style={{ textAlign: "center", fontSize: "1.8rem", letterSpacing: ".5em", fontWeight: 700 }} />
      <button className="btn" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and continue"}</button>
      <div className="row" id="hint" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn link" disabled={left > 0} onClick={resend}>{left > 0 ? `Resend code in ${left}s` : "Resend code"}</button>
        <Link href="/register" className="muted"><u>Use a different email</u></Link>
      </div>
    </form>
  );
}
export default function Page() { return <Suspense fallback={<div className="container empty">Loading…</div>}><Form /></Suspense>; }
