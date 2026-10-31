"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { saveHint } from "@/lib/verifyHint";

function Form() {
  const { register } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const other = `${"/login"}${safeNext !== "/" ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const sent = await register(name, email, password); saveHint(sent); router.push(`/verify?email=${encodeURIComponent(sent.email)}${safeNext !== "/" ? `&next=${encodeURIComponent(safeNext)}` : ""}`); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  }
  return (
    <form className="panel stack narrow" onSubmit={submit}>
      <h1 style={{ margin: 0 }}>Create account</h1>
      {error && <div className="error" role="alert">{error}</div>}
      <label htmlFor="n">Full name</label><input id="n" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="e">Email</label><input id="e" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="p">Password (min 8 characters)</label>
      <div className="row" style={{ flexWrap: "nowrap" }}><input id="p" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="btn ghost sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button></div>
      <button className="btn" disabled={busy}>{busy ? "Please wait…" : "Create account"}</button>
      <span className="muted">Have an account? <Link href={other}><u>Log in</u></Link></span>
    </form>
  );
}
export default function Page() { return <Suspense fallback={<div className="container empty">Loading…</div>}><Form /></Suspense>; }
