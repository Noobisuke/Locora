"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Apply() {
  const { user, ready, refresh } = useAuth();
  const [app, setApp] = useState<{ status: string; reviewNote: string | null; storeName: string } | null>(null);
  const [f, setF] = useState({ storeName: "", description: "", contactPhone: "", address: "", serviceArea: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) api<{ application: typeof app }>("/seller/application").then((r) => { setApp(r.application); if (r.application?.status === "APPROVED") refresh(); }).catch(() => {}); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return <div className="container empty">Loading…</div>;
  if (!user) return <div className="container empty">Please <Link href="/login?next=/seller/apply"><u>log in</u></Link> first.</div>;
  if (user.role === "SELLER") return <div className="container empty">You are an approved seller. <Link href="/seller"><u>Open your dashboard</u></Link></div>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const r = await api<{ application: NonNullable<typeof app> }>("/seller/apply", { method: "POST", body: { ...f, description: f.description || undefined } }); setApp(r.application); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <form className="panel stack narrow" style={{ maxWidth: 560 }} onSubmit={submit}>
        <h1 style={{ margin: 0 }}>Become a Seller</h1>
        {app && <div className="panel" style={{ background: "#f5f5f4" }}>Latest application “{app.storeName}”: <span className="badge">{app.status}</span>{app.reviewNote && <div className="muted">Note: {app.reviewNote}</div>}
          {app.status === "APPROVED" && <div>Approved! Your account is now a seller account. Open <b>Seller</b> from the menu.</div>}</div>}
        {(!app || app.status === "REJECTED") && <>
          {error && <div className="error">{error}</div>}
          <label>Store name</label><input required value={f.storeName} onChange={set("storeName")} />
          <label>Description</label><textarea rows={3} value={f.description} onChange={set("description")} />
          <label>Contact phone</label><input required inputMode="tel" value={f.contactPhone} onChange={set("contactPhone")} />
          <label>Store address</label><input required value={f.address} onChange={set("address")} />
          <label>Service area (city / localities)</label><input required value={f.serviceArea} onChange={set("serviceArea")} />
          <button className="btn" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button></>}
      </form>
    </div>
  );
}
