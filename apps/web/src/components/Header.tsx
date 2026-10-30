"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, CartData } from "@/lib/api";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  useEffect(() => { setQ(sp.get("q") ?? ""); }, [sp]); // keep the box in sync with the URL
  // Cart badge: refreshed on login/logout and whenever any page announces a cart change.
  useEffect(() => {
    if (!user) { setCount(0); return; }
    const load = () => api<CartData>("/cart").then((c) => setCount(c.items.reduce((s, i) => s + i.quantity, 0))).catch(() => {});
    load();
    window.addEventListener("locora:cart", load);
    return () => window.removeEventListener("locora:cart", load);
  }, [user]);
  const go = () => setOpen(false);
  return (
    <header className="header"><div className="container header-row">
      <Link href="/" className="logo">Loc<span>o</span>ra</Link>
      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); go(); router.push(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : "/products"); }}>
        <input aria-label="Search products" placeholder="Search products near you" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" type="submit">Search</button>
      </form>
      <button className="btn ghost menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>{open ? "✕" : "☰"}</button>
      <nav className={`nav ${open ? "open" : ""}`} aria-label="Main" onClick={go}>
        <Link className="btn link" href="/cart">Cart{count > 0 && <span className="count">{count}</span>}</Link>
        {user ? (<>
          <Link className="btn link" href="/orders">Orders</Link>
          <Link className="btn link" href="/account">Account</Link>
          {user.role === "CUSTOMER" && <Link className="btn link" href="/seller/apply">Become a Seller</Link>}
          {user.role === "SELLER" && <Link className="btn link" href="/seller">Seller</Link>}
          {user.role === "ADMIN" && <Link className="btn link" href="/admin">Admin</Link>}
          {user.role === "DELIVERY" && <Link className="btn link" href="/delivery">Deliveries</Link>}
          <span className="muted">Hi, {user.name.split(" ")[0]}</span>
          <button className="btn ghost" onClick={() => { logout(); router.push("/"); }}>Logout</button>
        </>) : (<>
          <Link className="btn link" href="/login">Login</Link>
          <Link className="btn" href="/register">Sign up</Link>
        </>)}
      </nav>
    </div></header>
  );
}
