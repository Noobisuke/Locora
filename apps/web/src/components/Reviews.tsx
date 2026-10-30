"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Data = { average: number | null; count: number; reviews: { id: string; rating: number; comment: string | null; createdAt: string; name: string }[] };

export default function Reviews({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [d, setD] = useState<Data | null>(null);
  const [rating, setRating] = useState(5); const [comment, setComment] = useState("");
  const [error, setError] = useState(""); const [msg, setMsg] = useState("");
  const load = useCallback(() => { api<Data>(`/products/${productId}/reviews`).then(setD).catch(() => {}); }, [productId]);
  useEffect(load, [load]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setMsg("");
    try { await api(`/products/${productId}/reviews`, { method: "POST", body: { rating, comment: comment || undefined } }); setMsg("Thanks for your review!"); setComment(""); load(); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <section className="stack" style={{ padding: "0 0 24px" }}>
      <h2 style={{ margin: 0 }}>Reviews {d && d.count > 0 && <span className="muted">· ★ {d.average} ({d.count})</span>}</h2>
      {d && d.count === 0 && <div className="muted">No reviews yet.</div>}
      {d?.reviews.map((r) => <div key={r.id} className="panel"><strong>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</strong> <span className="muted">{r.name} · {new Date(r.createdAt).toLocaleDateString("en-IN")}</span>{r.comment && <div>{r.comment}</div>}</div>)}
      {user && <form className="panel stack" onSubmit={submit} style={{ maxWidth: 480 }}>
        <strong>Write a review</strong><span className="muted">Only customers who received this product can review it.</span>
        <select aria-label="Rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 && "s"}</option>)}</select>
        <textarea aria-label="Comment" rows={3} maxLength={500} placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
        {error && <div className="error">{error}</div>}{msg && <div className="badge ok">{msg}</div>}
        <button className="btn" type="submit">Submit review</button></form>}
    </section>
  );
}
