"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

function Listing() {
  const sp = useSearchParams();
  const router = useRouter();
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [data, setData] = useState<{ products: Product[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState("");
  const [min, setMin] = useState(sp.get("minPrice") ? String(Number(sp.get("minPrice")) / 100) : "");
  const [max, setMax] = useState(sp.get("maxPrice") ? String(Number(sp.get("maxPrice")) / 100) : "");

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in changes)) next.delete("page"); // any filter change goes back to page 1
    router.push(`/products?${next.toString()}`);
  };
  useEffect(() => { api<{ categories: typeof cats }>("/categories").then((r) => setCats(r.categories)).catch(() => {}); }, []);
  useEffect(() => {
    setData(null); setError("");
    api<{ products: Product[]; total: number; pageSize: number }>(`/products?${sp.toString()}`).then(setData).catch((e) => setError(e.message));
  }, [sp]);

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="container layout">
      <aside className="panel stack" aria-label="Filters">
        <label htmlFor="cat">Category</label>
        <select id="cat" value={sp.get("category") ?? ""} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All</option>{cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
        <label htmlFor="sort">Sort by</label>
        <select id="sort" value={sp.get("sort") ?? "newest"} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
        </select>
        <label htmlFor="minp">Price (₹)</label>
        <div className="row"><input id="minp" aria-label="Min price" type="number" min="0" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} />
          <input aria-label="Max price" type="number" min="0" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} /></div>
        <button className="btn" onClick={() => set({ minPrice: min ? String(Math.round(Number(min) * 100)) : "", maxPrice: max ? String(Math.round(Number(max) * 100)) : "" })}>Apply</button>
      </aside>
      <section>
        <h2 style={{ marginTop: 0 }}>{sp.get("q") ? `Results for “${sp.get("q")}”` : "All products"}</h2>
        {error && <div className="error">{error}</div>}
        {!data && !error && <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>}
        {data?.products.length === 0 && <div className="empty">No products match your filters. <button className="btn link" onClick={() => router.push("/products")}>Clear filters</button></div>}
        {data && data.products.length > 0 && <>
          <div className="muted" style={{ marginBottom: 8 }}>{data.total} product{data.total === 1 ? "" : "s"}</div>
          <div className="grid">{data.products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          {pages > 1 && <nav className="pager" aria-label="Pagination">
            <button className="btn ghost" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>← Previous</button>
            <span>Page {page} of {pages}</span>
            <button className="btn ghost" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next →</button>
          </nav>}</>}
      </section>
    </div>
  );
}
export default function ProductsPage() { return <Suspense fallback={<div className="container empty">Loading…</div>}><Listing /></Suspense>; }
