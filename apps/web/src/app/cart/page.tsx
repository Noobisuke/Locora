"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, CartData } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupees } from "@/lib/format";
import SafeImage from "@/components/SafeImage";

export default function CartPage() {
  const { user, ready } = useAuth();
  const [cart, setCart] = useState<CartData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) api<CartData>("/cart").then(setCart).catch((e) => setError(e.message)); }, [user]);
  async function setQty(productId: string, quantity: number) {
    setError("");
    try { setCart(await api<CartData>("/cart/items", { method: "PUT", body: { productId, quantity } })); window.dispatchEvent(new Event("locora:cart")); } catch (e) { setError((e as Error).message); }
  }
  if (!ready) return <div className="container empty">Loading…</div>;
  if (!user) return <div className="container empty">Please <Link href="/login?next=/cart"><u>log in</u></Link> to see your cart.</div>;
  if (!cart && !error) return <div className="container empty">Loading cart…</div>;
  const blocked = cart?.items.some((i) => i.problem) ?? false;
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <h1>Your cart</h1>
      {error && <div className="error">{error}</div>}
      {cart && cart.items.length === 0 && <div className="empty">Your cart is empty. <Link href="/products"><u>Browse products</u></Link></div>}
      {cart && cart.items.length > 0 && (
        <div className="cart-layout">
          <div className="panel">
            {cart.items.map((i) => (
              <div className="line" key={i.productId}>
                <SafeImage src={i.image} alt={i.name} />
                <div className="grow">
                  <strong>{i.name}</strong><div className="muted">{i.store.name} · {rupees(i.unitPricePaise)}</div>
                  {i.problem && <span className="badge bad">{i.problem}</span>}
                </div>
                <div className="qty"><button aria-label="Decrease" onClick={() => setQty(i.productId, i.quantity - 1)}>−</button><strong>{i.quantity}</strong>
                  <button aria-label="Increase" onClick={() => setQty(i.productId, i.quantity + 1)}>+</button></div>
                <button className="btn link" onClick={() => setQty(i.productId, 0)}>Remove</button>
              </div>))}
          </div>
          <div className="panel stack" style={{ alignSelf: "start" }}>
            <div className="row" style={{ justifyContent: "space-between" }}><span>Subtotal</span><strong>{rupees(cart.subtotalPaise)}</strong></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span>Delivery</span><strong>{cart.deliveryFeePaise ? rupees(cart.deliveryFeePaise) : "Free"}</strong></div>
            <div className="row" style={{ justifyContent: "space-between", fontSize: "1.2rem" }}><span>Total</span><strong>{rupees(cart.totalPaise)}</strong></div>
            {blocked && <div className="error">Fix or remove unavailable items before checkout.</div>}
            {blocked ? <button className="btn" disabled>Checkout</button> : <Link className="btn" href="/checkout">Checkout</Link>}
            {cart.deliveryFeePaise > 0 && <span className="muted">Add {rupees(49900 - cart.subtotalPaise)} more for free delivery.</span>}
            <span className="muted">Final amount is confirmed by the server when you place the order.</span>
          </div>
        </div>)}
    </div>
  );
}
