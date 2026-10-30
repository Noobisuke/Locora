import Link from "next/link";
import { Product } from "@/lib/api";
import { rupees } from "@/lib/format";
import SafeImage from "./SafeImage";

export default function ProductCard({ p }: { p: Product }) {
  return (
    <Link href={`/products/${p.id}`} className="card">
      <SafeImage src={p.images[0]?.url} alt={p.name} />
      <div className="card-body">
        <strong>{p.name}</strong>
        <span className="muted">{p.store.name}</span>
        <div><span className="price">{rupees(p.pricePaise)}</span>{p.originalPricePaise && <span className="old">{rupees(p.originalPricePaise)}</span>}</div>
        <span className={`badge ${p.stock > 0 ? "ok" : "bad"}`} style={{ alignSelf: "flex-start" }}>{p.stock > 0 ? (p.stock <= 5 ? `Only ${p.stock} left` : "In stock") : "Out of stock"}</span>
      </div>
    </Link>
  );
}
