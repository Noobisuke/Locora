"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Address, Product } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import ProductCard from "@/components/ProductCard";

export default function Account() {
  const { user, ready } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]); const [wish, setWish] = useState<Product[]>([]); const [error, setError] = useState("");
  const load = () => {
    api<{ addresses: Address[] }>("/addresses").then((r) => setAddresses(r.addresses)).catch((e) => setError(e.message));
    api<{ products: Product[] }>("/wishlist").then((r) => setWish(r.products)).catch((e) => setError(e.message));
  };
  useEffect(() => { if (user) load(); }, [user]);
  if (!ready) return <div className="container empty">Loading…</div>;
  if (!user) return <div className="container empty">Please <Link href="/login?next=/account"><u>log in</u></Link>.</div>;
  return (
    <div className="container stack" style={{ padding: "24px 16px" }}>
      <h1 style={{ margin: 0 }}>My account</h1>
      <div className="panel"><strong>{user.name}</strong><div className="muted">{user.email} · {user.role}</div></div>
      {error && <div className="error">{error}</div>}
      <h2>Saved addresses</h2>
      {addresses.length === 0 && <div className="muted">No saved addresses. Add one at checkout.</div>}
      {addresses.map((a) => <div key={a.id} className="panel row" style={{ justifyContent: "space-between" }}>
        <span><strong>{a.label}</strong>{a.isDefault && <span className="badge ok"> default</span>}<br />{a.line1}, {a.city} {a.pincode} · {a.phone}</span>
        <button className="btn sm danger" onClick={() => confirm("Delete address?") && api(`/addresses/${a.id}`, { method: "DELETE" }).then(load).catch((e) => setError(e.message))}>Delete</button></div>)}
      <h2>Wishlist</h2>
      {wish.length === 0 ? <div className="muted">Your wishlist is empty.</div> : <div className="grid">{wish.map((p) => <div key={p.id} className="stack"><ProductCard p={p} />
        <button className="btn sm ghost" onClick={() => api(`/wishlist/${p.id}`, { method: "DELETE" }).then(load).catch((e) => setError(e.message))}>Remove</button></div>)}</div>}
    </div>
  );
}
