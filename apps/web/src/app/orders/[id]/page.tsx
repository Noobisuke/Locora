"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, Order } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupees } from "@/lib/format";
import { payOnline } from "@/lib/razorpay";

function Detail() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const placed = sp.get("placed"); const paidFlag = sp.get("paid"); const unpaidFlag = sp.get("unpaid");
  const { user, ready } = useAuth();
  const [o, setO] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) api<{ order: Order }>(`/orders/${id}`).then((r) => setO(r.order)).catch((e) => setError(e.message)); }, [user, id]);
  const reload = () => api<{ order: Order }>(`/orders/${id}`).then((r) => setO(r.order)).catch((e) => setError(e.message));
  async function payNow() {
    setError("");
    try { await payOnline(id, user!); await reload(); } catch (e) { setError((e as Error).message); }
  }
  async function cancel() {
    if (!confirm("Cancel this order?")) return;
    try { setO((await api<{ order: Order }>(`/orders/${id}/cancel`, { method: "POST" })).order); } catch (e) { setError((e as Error).message); }
  }
  if (!ready || (user && !o && !error)) return <div className="container empty">Loading…</div>;
  if (!user) return <div className="container empty">Please log in.</div>;
  if (!o) return <div className="container"><div className="error" style={{ marginTop: 24 }}>{error}</div></div>;
  const steps = ["PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"];
  return (
    <div className="container stack" style={{ padding: "24px 16px" }}>
      {placed && <div className="notice ok" role="status"><strong>✓ Order placed!</strong> Pay cash on delivery. The seller will confirm shortly.</div>}
      {paidFlag && <div className="notice ok" role="status"><strong>✓ Payment received.</strong> The seller will confirm your order shortly.</div>}
      {unpaidFlag && <div className="notice warn" role="status">Your order is saved but <strong>payment is not completed</strong>. Pay within 30 minutes or the order is cancelled automatically.</div>}
      <Link href="/orders" className="muted">← All orders</Link>
      <h1 style={{ margin: 0 }}>Order #{o.id.slice(-8).toUpperCase()}</h1>
      {error && <div className="error">{error}</div>}
      <div className="panel stack">
        <div className="row"><span className="badge">{o.status.replaceAll("_", " ")}</span>
          <span className="muted">Payment: {o.payments[0]?.method} — {o.payments[0]?.status}</span></div>
        {o.status !== "CANCELLED" && <div className="stepper" aria-label="Order progress">{steps.map((s, i) => { const at = steps.indexOf(o.status); return <span key={s} className={`step ${i < at ? "done" : i === at ? "now" : ""}`} aria-current={i === at ? "step" : undefined}>{s.replaceAll("_", " ")}</span>; })}</div>}
        {o.fulfillments.map((f) => <div key={f.id} className="muted">{f.store.name}: {f.status.replaceAll("_", " ")}{f.delivery ? ` · delivery ${f.delivery.status}` : ""}</div>)}
      </div>
      <div className="panel">
        {o.items.map((i) => <div key={i.id} className="row" style={{ justifyContent: "space-between" }}><span>{i.productName} × {i.quantity}{o.status === "DELIVERED" && <> · <Link href={`/products/${i.productId}`}><u>Write a review</u></Link></>}</span><span>{rupees(i.unitPricePaise * i.quantity)}</span></div>)}
        <hr style={{ border: 0, borderTop: "1px solid var(--line)" }} />
        <div className="row" style={{ justifyContent: "space-between" }}><span>Delivery</span><span>{o.deliveryFeePaise ? rupees(o.deliveryFeePaise) : "Free"}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><strong>Total</strong><strong>{rupees(o.totalPaise)}</strong></div>
      </div>
      <div className="panel"><strong>Deliver to</strong><div className="muted">{o.address.line1}, {o.address.city} {o.address.pincode} · {o.address.phone}</div></div>
      {o.status === "PENDING" && o.payments[0]?.method === "ONLINE" && o.payments[0]?.status === "PENDING" && <button className="btn" style={{ alignSelf: "flex-start" }} onClick={payNow}>Pay now {rupees(o.totalPaise)}</button>}
      {o.status === "PENDING" && <button className="btn danger" style={{ alignSelf: "flex-start" }} onClick={cancel}>Cancel order</button>}
      {o.status === "PENDING" && <span className="muted">You can cancel until a seller confirms the order.</span>}
    </div>
  );
}
export default function OrderPage() { return <Suspense fallback={<div className="container empty">Loading…</div>}><Detail /></Suspense>; }
