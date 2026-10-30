"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupees } from "@/lib/format";
import RoleGate from "@/components/RoleGate";

const NEXT: Record<string, { s: string; label: string }[]> = { ASSIGNED: [{ s: "PICKED_UP", label: "Pickup completed" }], PICKED_UP: [{ s: "IN_PROGRESS", label: "Out for delivery" }], IN_PROGRESS: [{ s: "DELIVERED", label: "Mark delivered" }, { s: "FAILED", label: "Delivery failed" }] };

function Deliveries() {
  const [list, setList] = useState<any[] | null>(null); const [error, setError] = useState("");
  const load = useCallback(() => { api<any>("/delivery").then((r) => setList(r.deliveries)).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);
  const active = list?.filter((d) => !["DELIVERED", "FAILED"].includes(d.status)) ?? [];
  const history = list?.filter((d) => ["DELIVERED", "FAILED"].includes(d.status)) ?? [];
  const card = (d: any) => { const f = d.fulfillment; const a = f.order.address; return (
    <div key={d.id} className="panel stack"><div className="row" style={{ justifyContent: "space-between" }}><strong>Order #{f.order.id.slice(-8).toUpperCase()}</strong><span className="badge">{d.status.replaceAll("_", " ")}</span></div>
      <div className="muted">Pick up from: {f.store.name}, {f.store.address} · {f.store.contactPhone}</div>
      <div>Deliver to: {a.line1}, {a.city} {a.pincode} · {a.phone}</div>
      <div className="muted">{f.items.map((i: any) => `${i.productName} ×${i.quantity}`).join(", ")}</div>
      {f.order.payments[0]?.method === "COD" && <strong>Collect cash for this seller&apos;s items: {rupees(f.subtotalPaise)}</strong>}
      <div className="row">{(NEXT[d.status] ?? []).map((n) => <button key={n.s} className={`btn sm ${n.s === "FAILED" ? "danger" : ""}`} onClick={() => api(`/delivery/${d.id}/status`, { method: "PATCH", body: { status: n.s } }).then(load).catch((e) => setError(e.message))}>{n.label}</button>)}</div></div>); };
  return (
    <div className="container stack" style={{ padding: "24px 16px" }}>
      <h1 style={{ margin: 0 }}>My deliveries</h1>
      {error && <div className="error">{error}</div>}{!list && !error && <div className="skeleton" />}
      {list && active.length === 0 && <div className="empty">No active deliveries. An admin assigns them to you.</div>}
      {active.map(card)}
      {history.length > 0 && <><h2>History</h2>{history.map(card)}</>}
    </div>
  );
}
export default function Page() { return <RoleGate role="DELIVERY"><Deliveries /></RoleGate>; }
