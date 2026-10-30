"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Product } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default function Home() {
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ categories: typeof cats }>("/categories").then((r) => setCats(r.categories)).catch(() => {});
    api<{ products: Product[] }>("/products?sort=newest&pageSize=12").then((r) => setProducts(r.products)).catch((e) => setError(e.message));
  }, []);
  return (<>
    <section className="hero"><div className="container">
      <h1>Everything Around You</h1><p>Your City, Your Store. Shop from local stores.</p>
    </div></section>
    <div className="container">
      <div className="chips">{cats.map((c) => <Link key={c.id} className="chip" href={`/products?category=${c.slug}`}>{c.name}</Link>)}</div>
      <h2>Recently added</h2>
      {error && <div className="error">{error}</div>}
      {!products && !error && <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>}
      {products?.length === 0 && <div className="empty">No products yet.</div>}
      {products && products.length > 0 && <div className="grid">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
    </div>
  </>);
}
