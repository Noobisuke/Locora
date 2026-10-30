"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, Address, CartData } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupees } from "@/lib/format";
import { payOnline } from "@/lib/razorpay";

const blank = { label: "Home", line1: "", line2: "", city: "", state: "Punjab", pincode: "", phone: "" };

export default function Checkout() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartData | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [sel, setSel] = useState("");
  const [form, setForm] = useState(blank);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"COD" | "ONLINE">("COD");
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const key = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); // same key on retry = no duplicate order (randomUUID only exists on https/localhost, hence the fallback)

  useEffect(() => {
    if (!user) return;
    api<{ onlineEnabled: boolean }>("/payments/config").then((r) => setOnlineEnabled(r.onlineEnabled)).catch(() => {});
    api<CartData>("/cart").then(setCart).catch((e) => setError(e.message));
    api<{ addresses: Address[] }>("/addresses").then((r) => { setAddresses(r.addresses); setSel(r.addresses.find((a) => a.isDefault)?.id ?? r.addresses[0]?.id ?? ""); setAdding(r.addresses.length === 0); }).catch((e) => setError(e.message));
  }, [user]);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try {
      const r = await api<{ address: Address }>("/addresses", { method: "POST", body: { ...form, line2: form.line2 || undefined } });
      setAddresses([r.address, ...addresses]); setSel(r.address.id); setAdding(false); setForm(blank);
    } catch (err) { setError((err as Error).message); }
  }
  async function placeOrder() {
    setBusy(true); setError("");
    try {
      const r = await api<{ order: { id: string } }>("/orders", { method: "POST", body: { addressId: sel, paymentMethod: method, idempotencyKey: key.current } });
      window.dispatchEvent(new Event("locora:cart"));
      if (method === "ONLINE" && user) {
        try { const out = await payOnline(r.order.id, user); router.push(`/orders/${r.order.id}?${out === "paid" ? "paid=1" : "unpaid=1"}`); }
        catch (e) { setError((e as Error).message + " Your order is saved. You can pay from My orders."); setTimeout(() => router.push(`/orders/${r.order.id}?unpaid=1`), 2500); }
        return;
      }
      window.dispatchEvent(new Event("locora:cart"));
      router.push(`/orders/${r.order.id}?placed=1`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  if (!ready) return <div className="container empty">Loading…</div>;
  if (!user) return <div className="container empty">Please <Link href="/login?next=/checkout"><u>log in</u></Link> to check out.</div>;
  if (cart && cart.items.length === 0 && !busy) return <div className="container empty">Your cart is empty. <Link href="/products"><u>Browse products</u></Link></div>;
  const problem = cart?.items.some((i) => i.problem) ?? false;
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <h1>Checkout</h1>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="detail" style={{ padding: 0 }}>
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Delivery address</h2>
          {addresses.map((a) => (
            <label key={a.id} className="row" style={{ fontWeight: 400, alignItems: "flex-start" }}>
              <input type="radio" name="addr" style={{ width: 20, minHeight: 20 }} checked={sel === a.id} onChange={() => setSel(a.id)} />
              <span><strong>{a.label}</strong><br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}<br /><span className="muted">{a.phone}</span></span>
            </label>))}
          {!adding && <button className="btn ghost" onClick={() => setAdding(true)}>+ Add new address</button>}
          {adding && (
            <form className="stack" onSubmit={saveAddress}>
              <input required placeholder="Label (Home, Work)" value={form.label} onChange={set("label")} />
              <input required placeholder="Address line 1" value={form.line1} onChange={set("line1")} />
              <input placeholder="Address line 2 (optional)" value={form.line2} onChange={set("line2")} />
              <div className="row"><input required placeholder="City" value={form.city} onChange={set("city")} /><input required placeholder="State" value={form.state} onChange={set("state")} /></div>
              <div className="row"><input required aria-label="Pincode" placeholder="Pincode (6 digits)" inputMode="numeric" pattern="[1-9][0-9]{5}" title="6-digit Indian pincode" maxLength={6} value={form.pincode} onChange={set("pincode")} /><input required aria-label="Phone" placeholder="Phone" inputMode="tel" pattern="[0-9+\- ]{7,15}" title="7-15 digits" value={form.phone} onChange={set("phone")} /></div>
              <button className="btn" type="submit">Save address</button>
            </form>)}
        </div>
        <div className="panel stack" style={{ alignSelf: "start" }}>
          <h2 style={{ margin: 0 }}>Order summary</h2>
          {cart?.items.map((i) => <div key={i.productId} className="row" style={{ justifyContent: "space-between" }}><span>{i.name} × {i.quantity}</span><span>{rupees(i.linePaise)}</span></div>)}
          <hr style={{ width: "100%", border: 0, borderTop: "1px solid var(--line)" }} />
          <div className="row" style={{ justifyContent: "space-between" }}><span>Delivery</span><span>{cart?.deliveryFeePaise ? rupees(cart.deliveryFeePaise) : "Free"}</span></div>
          <div className="row" style={{ justifyContent: "space-between", fontSize: "1.2rem" }}><strong>Total</strong><strong>{cart ? rupees(cart.totalPaise) : "…"}</strong></div>
          <div className="panel stack" style={{ background: "#f5f5f4", boxShadow: "none" }}>
            <strong>Payment method</strong>
            <label className="row" style={{ fontWeight: 400 }}><input type="radio" name="pay" style={{ width: 20, minHeight: 20 }} checked={method === "COD"} onChange={() => setMethod("COD")} /> Cash on delivery</label>
            <label className="row" style={{ fontWeight: 400, opacity: onlineEnabled ? 1 : 0.5 }}><input type="radio" name="pay" style={{ width: 20, minHeight: 20 }} disabled={!onlineEnabled} checked={method === "ONLINE"} onChange={() => setMethod("ONLINE")} /> Pay online (UPI / card / netbanking via Razorpay)</label>
            {!onlineEnabled && <span className="muted">Online payment is not configured on this server yet.</span>}</div>
          {problem && <div className="error">Some items are unavailable. <Link href="/cart"><u>Fix your cart</u></Link> first.</div>}
          <button className="btn" disabled={busy || !sel || !cart || problem} onClick={placeOrder}>{busy ? "Please wait…" : method === "ONLINE" ? "Place order & pay" : "Place order"}</button>
        </div>
      </div>
    </div>
  );
}
