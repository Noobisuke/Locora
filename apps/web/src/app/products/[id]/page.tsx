"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, CartData, Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupees } from "@/lib/format";
import SafeImage from "@/components/SafeImage";
import Reviews from "@/components/Reviews";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [p, setP] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => { api<{ product: Product }>(`/products/${id}`).then((r) => setP(r.product)).catch((e) => setError(e.message)); }, [id]);
  const needLogin = () => { router.push(`/login?next=/products/${id}`); };

  async function addToCart() {
    if (!user) return needLogin();
    setMsg(""); setError("");
    try {
      const cart = await api<CartData>("/cart");
      const have = cart.items.find((i) => i.productId === id)?.quantity ?? 0;
      const next = Math.min(have + qty, p?.stock ?? have + qty);
      await api("/cart/items", { method: "PUT", body: { productId: id, quantity: next } });
      window.dispatchEvent(new Event("locora:cart"));
      setMsg(next === have + qty ? `Added to cart (${next} in cart)` : `Cart updated: only ${next} available`);
    }
    catch (e) { setError((e as Error).message); }
  }
  async function wishlist() {
    if (!user) return needLogin();
    try { await api(`/wishlist/${id}`, { method: "PUT" }); setMsg("Saved to wishlist"); } catch (e) { setError((e as Error).message); }
  }

  if (error && !p) return <div className="container empty">{error}</div>;
  if (!p) return <div className="container"><div className="skeleton" style={{ marginTop: 24, minHeight: 360 }} /></div>;
  const out = p.stock <= 0;
  return (<>
    <div className="container detail">
      <div>
        <SafeImage key={img} src={p.images[img]?.url} alt={p.name} />
        {p.images.length > 1 && <div className="thumbs">{p.images.map((im, i) => (
          <button key={im.id} className={i === img ? "on" : ""} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={im.url} alt="" /></button>))}</div>}
      </div>
      <div className="stack">
        <span className="muted">{p.category.name} · Sold by {p.store.name}</span>
        <h1 style={{ margin: 0 }}>{p.name}</h1>
        <div><span className="price" style={{ fontSize: "1.5rem" }}>{rupees(p.pricePaise)}</span>{p.originalPricePaise && <span className="old">{rupees(p.originalPricePaise)}</span>}</div>
        <span className={`badge ${out ? "bad" : "ok"}`} style={{ alignSelf: "flex-start" }}>{out ? "Out of stock" : `${p.stock} available`}</span>
        <p>{p.description}</p>
        {!out && <div className="qty"><button aria-label="Decrease" onClick={() => setQty(Math.max(1, qty - 1))}>−</button><strong>{qty}</strong><button aria-label="Increase" onClick={() => setQty(Math.min(p.stock, qty + 1))}>+</button></div>}
        <div className="row">
          <button className="btn" disabled={out} onClick={addToCart}>{out ? "Unavailable" : "Add to cart"}</button>
          <button className="btn ghost" onClick={wishlist}>♡ Save to wishlist</button>
          {user && <button className="btn link" onClick={() => router.push("/cart")}>View cart →</button>}
        </div>
        {msg && <div className="badge ok" role="status" style={{ alignSelf: "flex-start" }}>{msg}</div>}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
    <div className="container"><Reviews productId={p.id} /></div>
  </>);
}
