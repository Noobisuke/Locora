"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, apiUpload } from "@/lib/api";
import RoleGate from "@/components/RoleGate";
import SafeImage from "@/components/SafeImage";

type NewImg = { file: File; preview: string };
const MAX = 5 * 1024 * 1024;

function Form() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [cats, setCats] = useState<any[]>([]);
  const [f, setF] = useState({ name: "", description: "", categoryId: "", price: "", originalPrice: "", stock: "0", isActive: true });
  const [existing, setExisting] = useState<any[]>([]);
  const [fresh, setFresh] = useState<NewImg[]>([]);
  const [errors, setErrors] = useState<string[]>([]); const [busy, setBusy] = useState(false);

  const loadProduct = () => api<any>("/seller/products").then((r) => {
    const p = r.products.find((x: any) => x.id === id);
    if (!p) return setErrors(["Product not found"]);
    setExisting(p.images);
    setF({ name: p.name, description: p.description, categoryId: p.categoryId, price: String(p.pricePaise / 100), originalPrice: p.originalPricePaise ? String(p.originalPricePaise / 100) : "", stock: String(p.stock), isActive: p.isActive });
  }).catch((e) => setErrors([e.message]));
  useEffect(() => { api<any>("/categories").then((r) => setCats(r.categories)).catch(() => {}); if (!isNew) loadProduct(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => fresh.forEach((i) => URL.revokeObjectURL(i.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const errs: string[] = []; const add: NewImg[] = [];
    Array.from(e.target.files ?? []).forEach((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) errs.push(`${file.name}: only JPEG, PNG or WebP`);
      else if (file.size > MAX) errs.push(`${file.name}: larger than 5 MB`);
      else add.push({ file, preview: URL.createObjectURL(file) });
    });
    if (existing.length + fresh.length + add.length > 6) errs.push("Maximum 6 images per product");
    else setFresh([...fresh, ...add]);
    setErrors(errs); e.target.value = "";
  }
  const makeFirst = (i: number) => setFresh([fresh[i], ...fresh.filter((_, k) => k !== i)]); // first = primary (when product has no image yet)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErrors([]);
    const body = { name: f.name, description: f.description, categoryId: f.categoryId, pricePaise: Math.round(Number(f.price) * 100),
      originalPricePaise: f.originalPrice ? Math.round(Number(f.originalPrice) * 100) : null, stock: Number(f.stock), isActive: f.isActive };
    try {
      const pid = isNew ? (await api<any>("/seller/products", { method: "POST", body })).product.id : (await api<any>(`/seller/products/${id}`, { method: "PUT", body })).product.id;
      const failed: string[] = [];
      for (const img of fresh) { try { await apiUpload(`/seller/products/${pid}/images`, img.file); } catch (err) { failed.push(`${img.file.name}: ${(err as Error).message}`); } }
      if (failed.length) { setErrors(["Product saved, but some images failed:", ...failed]); setFresh([]); if (isNew) router.replace(`/seller/products/${pid}`); else loadProduct(); setBusy(false); return; }
      router.push("/seller");
    } catch (err) { setErrors([(err as Error).message]); setBusy(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <form className="panel stack" style={{ maxWidth: 720 }} onSubmit={submit}>
        <h1 style={{ margin: 0 }}>{isNew ? "Add product" : "Edit product"}</h1>
        {errors.length > 0 && <div className="error" role="alert">{errors.map((x, i) => <div key={i}>{x}</div>)}</div>}
        <label>Name</label><input required minLength={2} value={f.name} onChange={set("name")} />
        <label>Description</label><textarea required minLength={5} rows={4} value={f.description} onChange={set("description")} />
        <label>Category</label><select required value={f.categoryId} onChange={set("categoryId")}><option value="">Select…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <div className="row"><div style={{ flex: 1 }}><label>Price (₹)</label><input required type="number" min="1" step="0.01" value={f.price} onChange={set("price")} /></div>
          <div style={{ flex: 1 }}><label>Original price (₹, optional)</label><input type="number" min="0" step="0.01" value={f.originalPrice} onChange={set("originalPrice")} /></div>
          <div style={{ flex: 1 }}><label>Stock</label><input required type="number" min="0" step="1" value={f.stock} onChange={set("stock")} /></div></div>
        <label className="row" style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Visible to customers</label>

        <label>Images (up to 6, JPEG/PNG/WebP, 5 MB each)</label>
        <div className="previews">
          {existing.map((im, i) => <div key={im.id} className="preview"><SafeImage src={im.url} alt="Saved image" />
            {i === 0 ? <span className="badge ok">Primary</span> : <button type="button" className="btn sm ghost" onClick={() => api(`/seller/products/${id}/images/${im.id}/primary`, { method: "PUT" }).then(loadProduct).catch((e) => setErrors([e.message]))}>Make primary</button>}
            <button type="button" className="btn sm danger" onClick={() => confirm("Remove this image?") && api(`/seller/products/${id}/images/${im.id}`, { method: "DELETE" }).then(loadProduct).catch((e) => setErrors([e.message]))}>Remove</button></div>)}
          {fresh.map((im, i) => <div key={im.preview} className="preview"><SafeImage src={im.preview} alt="New image" />
            <span className="badge">{existing.length === 0 && i === 0 ? "Primary (new)" : "New"}</span>
            {existing.length === 0 && i > 0 && <button type="button" className="btn sm ghost" onClick={() => makeFirst(i)}>Make primary</button>}
            <button type="button" className="btn sm danger" onClick={() => { URL.revokeObjectURL(im.preview); setFresh(fresh.filter((_, k) => k !== i)); }}>Remove</button></div>)}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pick} />
        <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save product"}</button>
      </form>
    </div>
  );
}
export default function Page() { return <RoleGate role="SELLER"><Form /></RoleGate>; }
