"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { saveHint } from "@/lib/verifyHint";

function Form() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const other = `${"/register"}${safeNext !== "/" ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await login(email, password); router.push(safeNext); }
    catch (err) {
      if (err instanceof ApiError && err.data.code === "EMAIL_NOT_VERIFIED") {
        saveHint({ email: err.data.email ?? email, devCode: err.data.devCode, resendIn: err.data.resendIn });
        router.push(`/verify?email=${encodeURIComponent(err.data.email ?? email)}${safeNext !== "/" ? `&next=${encodeURIComponent(safeNext)}` : ""}`);
        return;
      }
      setError((err as Error).message); setBusy(false);
    }
  }
  return (
    <form className="panel stack narrow" onSubmit={submit}>
      <h1 style={{ margin: 0 }}>Log in</h1>
      {error && <div className="error" role="alert">{error}</div>}
            <label htmlFor="e">Email</label><input id="e" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="p">Password </label>
      <div className="row" style={{ flexWrap: "nowrap" }}><input id="p" type={show ? "text" : "password"} autoComplete="current-password" required minLength={1} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="btn ghost sm" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button></div>
      <button className="btn" disabled={busy}>{busy ? "Please wait…" : "Log in"}</button>
      <span className="muted">New here? <Link href={other}><u>Create an account</u></Link></span>
    </form>
  );
}
export default function Page() { return <Suspense fallback={<div className="container empty">Loading…</div>}><Form /></Suspense>; }
