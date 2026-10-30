"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Order } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rupees } from "@/lib/format";

export default function Orders() {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) api<{ orders: Order[] }>("/orders").then((r) => setOrders(r.orders)).catch((e) => setError(e.message)); }, [user]);
  if (!ready) return <div className="container empty">Loading…</div>;
  if (!user) return <div className="container empty">Please <Link href="/login?next=/orders"><u>log in</u></Link>.</div>;
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <h1>My orders</h1>
      {error && <div className="error">{error}</div>}
      {!orders && !error && <div className="skeleton" />}
      {orders?.length === 0 && <div className="empty">No orders yet. <Link href="/products"><u>Start shopping</u></Link></div>}
      <div className="stack">{orders?.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="panel row" style={{ justifyContent: "space-between" }}>
          <div><strong>Order #{o.id.slice(-8).toUpperCase()}</strong><div className="muted">{new Date(o.createdAt).toLocaleString("en-IN")} · {o.items.length} item(s)</div></div>
          <div className="row"><span className="badge">{o.status.replaceAll("_", " ")}</span><strong>{rupees(o.totalPaise)}</strong></div>
        </Link>))}</div>
    </div>
  );
}
