"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupees } from "@/lib/format";
import RoleGate from "@/components/RoleGate";

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "applications", label: "Applications", icon: "📝" },
  { id: "products", label: "Products", icon: "📦" },
  { id: "orders", label: "Orders", icon: "🛍️" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "audit", label: "Audit Logs", icon: "📋" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Admin() {
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const load = useCallback(() => {
    setData(null);
    setError("");
    const path: Record<TabId, string> = {
      overview: "/admin/dashboard",
      applications: "/admin/seller-applications?status=PENDING",
      products: "/admin/products",
      orders: "/admin/orders",
      users: "/admin/users",
      audit: "/admin/audit-logs",
    };
    api<any>(path[tab])
      .then(setData)
      .catch((e) => setError(e.message));

    if (tab === "orders") {
      api<any>("/admin/delivery-partners")
        .then((r) => setPartners(r.partners ?? []))
        .catch(() => {});
    }
  }, [tab]);

  useEffect(load, [load]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setError("");
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="container" style={{ padding: "32px 16px", maxWidth: "1280px" }}>
      {/* Header */}
      <div className="admin-header">
        <div className="admin-title-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.6rem" }}>⚡</span>
            <h1>Admin Operations Hub</h1>
          </div>
          <p>Monitor platform metrics, moderate stores & catalogs, and manage fulfillment operations.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="btn sm ghost" onClick={load} title="Refresh current view">
            ↻ Refresh Data
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tabs-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`admin-tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => {
              setTab(t.id);
              setSearchFilter("");
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {tab === "overview" && t.id === "applications" && data?.pendingApplications > 0 && (
              <span className="tab-badge">{data.pendingApplications}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications */}
      {error && <div className="notice warn" style={{ marginBottom: 16 }}>⚠️ {error}</div>}
      {msg && <div className="notice ok" style={{ marginBottom: 16 }}>✓ {msg}</div>}

      {/* Loading Skeleton */}
      {!data && !error && (
        <div className="admin-card" style={{ padding: "40px 20px" }}>
          <div className="skeleton" style={{ minHeight: "260px" }} />
        </div>
      )}

      {/* OVERVIEW TAB */}
      {data && tab === "overview" && (
        <div>
          <div className="metric-grid">
            <div className="metric-card">
              <span className="metric-title">👥 Total Users</span>
              <div className="metric-val">{data.users ?? 0}</div>
              <div className="metric-sub">Registered accounts</div>
            </div>
            <div className="metric-card">
              <span className="metric-title">🏪 Active Stores</span>
              <div className="metric-val">{data.stores ?? 0}</div>
              <div className="metric-sub">Verified sellers</div>
            </div>
            <div className="metric-card">
              <span className="metric-title">📦 Total Products</span>
              <div className="metric-val">{data.products ?? 0}</div>
              <div className="metric-sub">Across all categories</div>
            </div>
            <div className="metric-card" style={{ borderLeft: "4px solid var(--accent)" }}>
              <span className="metric-title">📝 Pending Reviews</span>
              <div className="metric-val" style={{ color: "var(--accent)" }}>
                {data.pendingApplications ?? 0}
              </div>
              <div className="metric-sub">Seller applications waiting</div>
            </div>
            <div className="metric-card" style={{ borderLeft: "4px solid var(--ok)" }}>
              <span className="metric-title">💰 Gross Revenue</span>
              <div className="metric-val" style={{ color: "var(--ok)" }}>
                {rupees(data.revenuePaise ?? 0)}
              </div>
              <div className="metric-sub">Non-cancelled orders</div>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-head">
              <h2 className="admin-card-title">Order Status Breakdown</h2>
            </div>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
                {(data.ordersByStatus ?? []).map((o: any) => (
                  <div
                    key={o.status}
                    style={{
                      padding: "16px",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      {o.status.replaceAll("_", " ")}
                    </div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "6px" }}>{o._count}</div>
                  </div>
                ))}
                {(data.ordersByStatus ?? []).length === 0 && (
                  <div className="muted" style={{ padding: "12px" }}>No orders placed yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPLICATIONS TAB */}
      {data && tab === "applications" && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">Pending Seller Applications</h2>
            <span className="badge">{(data.applications ?? []).length} waiting</span>
          </div>
          {(data.applications ?? []).length === 0 ? (
            <div className="empty">
              <span style={{ fontSize: "2rem" }}>🎉</span>
              <p style={{ marginTop: "10px" }}>No pending seller applications to review!</p>
            </div>
          ) : (
            <div className="card-item-stack">
              {(data.applications ?? []).map((a: any) => (
                <div key={a.id} className="app-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem" }}>{a.storeName}</h3>
                      <div className="muted" style={{ fontSize: "0.85rem" }}>
                        Applicant: <strong>{a.user?.name}</strong> ({a.user?.email}) · Phone: {a.contactPhone}
                      </div>
                    </div>
                    <span className="tag-pill tag-pending">Pending Approval</span>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", fontSize: "0.9rem" }}>
                    <div><strong>Address:</strong> {a.address}</div>
                    <div style={{ marginTop: "4px" }}><strong>Service Area:</strong> {a.serviceArea}</div>
                    {a.description && (
                      <div style={{ marginTop: "6px", color: "var(--muted)" }}>
                        <em>&ldquo;{a.description}&rdquo;</em>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                    <button
                      className="btn sm"
                      onClick={() =>
                        act(
                          () =>
                            api(`/admin/seller-applications/${a.id}/review`, {
                              method: "POST",
                              body: { decision: "APPROVED" },
                            }),
                          "Application approved and store created!"
                        )
                      }
                    >
                      ✓ Approve Store
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() => {
                        const note = prompt("Reason for rejection (optional)") ?? undefined;
                        act(
                          () =>
                            api(`/admin/seller-applications/${a.id}/review`, {
                              method: "POST",
                              body: { decision: "REJECTED", note },
                            }),
                          "Application rejected"
                        );
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {data && tab === "products" && (
        <div className="admin-card">
          <div className="admin-card-head">
            <div>
              <h2 className="admin-card-title">Product Moderation</h2>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {(data.products ?? []).length} products listed
              </div>
            </div>
            <input
              type="text"
              placeholder="Search product or store…"
              className="search-input-pill"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Moderation</th>
                </tr>
              </thead>
              <tbody>
                {(data.products ?? [])
                  .filter((p: any) =>
                    !searchFilter ||
                    p.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    p.store?.name?.toLowerCase().includes(searchFilter.toLowerCase())
                  )
                  .map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {p.images?.[0]?.url ? (
                            <img src={p.images[0].url} alt="" className="product-row-thumb" />
                          ) : (
                            <div className="product-row-thumb" style={{ display: "grid", placeItems: "center", color: "#94a3b8" }}>📦</div>
                          )}
                          <div>
                            <strong>{p.name}</strong>
                            {p.isSample && <span className="badge" style={{ marginLeft: "6px" }}>Sample</span>}
                            {p.isFeatured && <span className="badge" style={{ marginLeft: "6px", background: "#fef3c7", color: "#b45309" }}>Featured</span>}
                          </div>
                        </div>
                      </td>
                      <td>{p.store?.name ?? "—"}</td>
                      <td><strong>{rupees(p.pricePaise)}</strong></td>
                      <td>
                        <span style={{ fontWeight: 600, color: p.stock > 0 ? "inherit" : "var(--danger)" }}>
                          {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                        </span>
                      </td>
                      <td>
                        {p.moderationBlocked ? (
                          <span className="tag-pill tag-blocked">Blocked</span>
                        ) : p.isActive ? (
                          <span className="tag-pill tag-active">Active</span>
                        ) : (
                          <span className="tag-pill tag-inactive">Inactive</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn sm ${p.moderationBlocked ? "" : "ghost"}`}
                          onClick={() =>
                            act(
                              () =>
                                api(`/admin/products/${p.id}/moderation`, {
                                  method: "PATCH",
                                  body: { blocked: !p.moderationBlocked },
                                }),
                              p.moderationBlocked ? "Product unblocked" : "Product blocked"
                            )
                          }
                        >
                          {p.moderationBlocked ? "Unblock" : "Block"}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDERS TAB */}
      {data && tab === "orders" && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">Live Orders & Logistics</h2>
            <span className="badge">{(data.orders ?? []).length} orders</span>
          </div>
          {(data.orders ?? []).length === 0 ? (
            <div className="empty">No customer orders recorded yet.</div>
          ) : (
            <div className="card-item-stack">
              {(data.orders ?? []).map((o: any) => (
                <div key={o.id} className="app-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: "1.1rem" }}>#{o.id.slice(-8).toUpperCase()}</strong>
                      <span className="muted" style={{ marginLeft: "8px" }}>by {o.user?.name ?? "Customer"}</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span className="tag-pill tag-pending">{o.status.replaceAll("_", " ")}</span>
                      <strong style={{ fontSize: "1.1rem", color: "var(--brand)" }}>{rupees(o.totalPaise)}</strong>
                    </div>
                  </div>

                  <div className="muted" style={{ fontSize: "0.88rem" }}>
                    Payment: <strong>{o.payments?.[0]?.method ?? "N/A"}</strong> — Status: {o.payments?.[0]?.status ?? "N/A"}
                  </div>

                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
                      Fulfillments & Delivery
                    </div>
                    {(o.fulfillments ?? []).map((f: any) => (
                      <div
                        key={f.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px",
                          background: "#f8fafc",
                          padding: "10px 14px",
                          borderRadius: "8px",
                        }}
                      >
                        <div>
                          <strong>{f.store?.name}</strong>: <span className="badge">{f.status.replaceAll("_", " ")}</span>
                          {f.delivery && <span className="muted" style={{ marginLeft: "6px" }}>· Delivery: {f.delivery.status}</span>}
                        </div>
                        {!f.delivery && (f.status === "PACKED" || f.status === "HANDED_OVER") && (
                          partners.length === 0 ? (
                            <span className="muted" style={{ fontSize: "0.85rem" }}>No active delivery partners</span>
                          ) : (
                            <select
                              style={{ width: "auto", minHeight: "36px", padding: "4px 10px", fontSize: "0.85rem" }}
                              defaultValue=""
                              onChange={(e) =>
                                e.target.value &&
                                act(
                                  () =>
                                    api(`/admin/fulfillments/${f.id}/assign`, {
                                      method: "POST",
                                      body: { partnerId: e.target.value },
                                    }),
                                  "Delivery partner assigned!"
                                )
                              }
                            >
                              <option value="">Assign delivery partner…</option>
                              {partners.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.phone ?? "No phone"})
                                </option>
                              ))}
                            </select>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* USERS TAB */}
      {data && tab === "users" && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">User Accounts & Roles</h2>
            <input
              type="text"
              placeholder="Search user name or email…"
              className="search-input-pill"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Account Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data.users ?? [])
                  .filter((u: any) =>
                    !searchFilter ||
                    u.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    u.email?.toLowerCase().includes(searchFilter.toLowerCase())
                  )
                  .map((u: any) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <div className="muted" style={{ fontSize: "0.82rem" }}>{u.email}</div>
                      </td>
                      <td>
                        <span className="tag-pill tag-role">{u.role}</span>
                      </td>
                      <td>
                        {u.isActive ? (
                          <span className="tag-pill tag-active">Active</span>
                        ) : (
                          <span className="tag-pill tag-blocked">Deactivated</span>
                        )}
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button
                            className="btn sm ghost"
                            onClick={() =>
                              act(
                                () =>
                                  api(`/admin/users/${u.id}/active`, {
                                    method: "PATCH",
                                    body: { isActive: !u.isActive },
                                  }),
                                "Account status updated"
                              )
                            }
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                          {u.role === "CUSTOMER" && (
                            <button
                              className="btn sm ghost"
                              onClick={() =>
                                act(
                                  () =>
                                    api(`/admin/users/${u.id}/delivery-partner`, {
                                      method: "PATCH",
                                      body: { enabled: true },
                                    }),
                                  "Promoted to delivery partner"
                                )
                              }
                            >
                              Make Delivery Partner
                            </button>
                          )}
                          {u.role === "DELIVERY" && (
                            <button
                              className="btn sm ghost"
                              onClick={() =>
                                act(
                                  () =>
                                    api(`/admin/users/${u.id}/delivery-partner`, {
                                      method: "PATCH",
                                      body: { enabled: false },
                                    }),
                                  "Delivery partner role removed"
                                )
                              }
                            >
                              Revoke Delivery Role
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT TAB */}
      {data && tab === "audit" && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">Security & Audit Trails</h2>
            <span className="badge">Latest {(data.logs ?? []).length} logs</span>
          </div>
          <div className="table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin Actor</th>
                  <th>Action</th>
                  <th>Target Entity</th>
                </tr>
              </thead>
              <tbody>
                {(data.logs ?? []).map((l: any) => (
                  <tr key={l.id}>
                    <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(l.createdAt).toLocaleString("en-IN")}
                    </td>
                    <td><strong>{l.actor?.name ?? "Admin"}</strong></td>
                    <td>
                      <span className="badge" style={{ background: "#f1f5f9", fontFamily: "monospace" }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted)", fontFamily: "monospace" }}>
                      {l.targetType} ({l.targetId?.slice(-8)})
                    </td>
                  </tr>
                ))}
                {(data.logs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                      No audit logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RoleGate role="ADMIN">
      <Admin />
    </RoleGate>
  );
}
