"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, apiUpload } from "@/lib/api";
import { rupees } from "@/lib/format";
import RoleGate from "@/components/RoleGate";
import SafeImage from "@/components/SafeImage";

const NEXT: Record<string, string[]> = { PENDING: ["CONFIRMED", "REJECTED"], CONFIRMED: ["PACKED"], PACKED: ["HANDED_OVER"] };

function Dashboard() {
  const [tab, setTab] = useState<"products" | "orders" | "store">("products");
  const [dash, setDash] = useState<any>(null); const [products, setProducts] = useState<any[] | null>(null);
  const [orders, setOrders] = useState<any[] | null>(null); const [store, setStore] = useState<any>(null);
  const [error, setError] = useState(""); const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    api("/seller/dashboard").then(setDash).catch((e) => setError(e.message));
    api<any>("/seller/products").then((r) => setProducts(r.products)).catch((e) => setError(e.message));
    api<any>("/seller/orders").then((r) => setOrders(r.fulfillments)).catch((e) => setError(e.message));
    api<any>("/seller/store").then((r) => setStore(r.store)).catch(() => {});
  }, []);
  useEffect(load, [load]);
  async function act(fn: () => Promise<unknown>) { setError(""); setMsg(""); try { await fn(); load(); } catch (e) { setError((e as Error).message); } }
  async function saveStore(e: React.FormEvent) {
    e.preventDefault();
    await act(async () => { await api("/seller/store", { method: "PUT", body: { name: store.name, description: store.description ?? undefined, contactPhone: store.contactPhone, address: store.address, serviceArea: store.serviceArea } }); setMsg("Store saved"); });
  }
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}><h1 style={{ margin: 0 }}>Seller dashboard</h1><Link className="btn" href="/seller/products/new">+ Add product</Link></div>
      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}{msg && <div className="badge ok" style={{ marginTop: 12 }}>{msg}</div>}
      {dash && <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><b>{dash.totalProducts}</b>Products</div><div className="stat"><b>{dash.activeProducts}</b>Active</div>
        <div className="stat"><b>{dash.orders.pending}</b>Pending orders</div><div className="stat"><b>{dash.orders.confirmed}</b>Confirmed</div>
        <div className="stat"><b>{dash.orders.completed}</b>Completed</div><div className="stat"><b>{rupees(dash.salesPaise)}</b>Sales</div></div>}
      {dash?.lowStock.length > 0 && <div className="panel" style={{ marginTop: 12, background: "#fef3c7" }}>⚠ Low stock: {dash.lowStock.map((p: any) => `${p.name} (${p.stock})`).join(", ")}</div>}
      <div className="tabs" role="tablist">{(["products", "orders", "store"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>

      {tab === "products" && (!products ? <div className="skeleton" /> : products.length === 0 ? <div className="empty">No products yet. Add your first one!</div> :
        <div className="panel table-wrap"><table><thead><tr><th></th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>
          {products.map((p) => <tr key={p.id}><td style={{ width: 64 }}><SafeImage src={p.images[0]?.url} alt={p.name} /></td><td>{p.name}<div className="muted">{p.category.name}</div></td>
            <td>{rupees(p.pricePaise)}</td><td>{p.stock}</td>
            <td><span className={`badge ${p.isActive && !p.moderationBlocked ? "ok" : "bad"}`}>{p.moderationBlocked ? "Blocked by admin" : p.isActive ? "Active" : "Inactive"}</span></td>
            <td><div className="cell-actions"><Link className="btn sm ghost" href={`/seller/products/${p.id}`}>Edit</Link>
              {p.isActive && <button className="btn sm danger" onClick={() => confirm("Deactivate this product?") && act(() => api(`/seller/products/${p.id}`, { method: "DELETE" }))}>Deactivate</button>}</div></td></tr>)}
        </tbody></table></div>)}

      {tab === "orders" && (!orders ? <div className="skeleton" /> : orders.length === 0 ? <div className="empty">No orders yet.</div> :
        <div className="stack">{orders.map((f) => <div key={f.id} className="panel stack">
          <div className="row" style={{ justifyContent: "space-between" }}><strong>Order #{f.orderId.slice(-8).toUpperCase()}</strong><span className="badge">{f.status.replaceAll("_", " ")}</span></div>
          {f.items.map((i: any) => <div key={i.id} className="row" style={{ justifyContent: "space-between" }}><span>{i.productName} × {i.quantity}</span><span>{rupees(i.unitPricePaise * i.quantity)}</span></div>)}
          <strong>Your total: {rupees(f.subtotalPaise)}</strong>
          <div className="muted">Deliver to: {f.order.address.line1}, {f.order.address.city} {f.order.address.pincode} · {f.order.address.phone} · Payment: {f.order.payments[0]?.method}</div>
          <div className="row">{(NEXT[f.status] ?? []).map((s) => <button key={s} className={`btn sm ${s === "REJECTED" ? "danger" : ""}`} onClick={() => act(() => api(`/seller/fulfillments/${f.id}/status`, { method: "PATCH", body: { status: s } }))}>{s === "CONFIRMED" ? "Confirm" : s === "REJECTED" ? "Reject" : s === "PACKED" ? "Mark packed" : "Handed over"}</button>)}</div>
        </div>)}</div>)}

      {tab === "store" && store && <form className="panel stack" style={{ maxWidth: 560 }} onSubmit={saveStore}>
        <label>Store name</label><input required value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
        <label>Description</label><textarea rows={3} value={store.description ?? ""} onChange={(e) => setStore({ ...store, description: e.target.value })} />
        <label>Contact phone</label><input required value={store.contactPhone} onChange={(e) => setStore({ ...store, contactPhone: e.target.value })} />
        <label>Address</label><input required value={store.address} onChange={(e) => setStore({ ...store, address: e.target.value })} />
        <label>Service area</label><input required value={store.serviceArea} onChange={(e) => setStore({ ...store, serviceArea: e.target.value })} />
        <label>Store logo (JPEG/PNG/WebP, max 5 MB)</label>
        {store.logoUrl && <div style={{ width: 96 }}><SafeImage src={store.logoUrl} alt={store.name} /></div>}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) act(async () => { await apiUpload("/seller/store/logo", f); setMsg("Logo updated"); }); }} />
        <button className="btn">Save store</button></form>}
    </div>
  );
}
export default function SellerPage() { return <RoleGate role="SELLER"><Dashboard /></RoleGate>; }
