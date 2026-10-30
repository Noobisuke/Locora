import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C, rupees } from "@/lib/theme";
import Img, { Btn } from "@/components/Img";

type P = { id: string; name: string; description: string; pricePaise: number; originalPricePaise: number | null; stock: number; images: { id: string; url: string }[]; store: { name: string }; category: { name: string } };

export default function Product() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth(); const router = useRouter();
  const [p, setP] = useState<P | null>(null); const [error, setError] = useState(""); const [msg, setMsg] = useState(""); const [qty, setQty] = useState(1);
  const w = Dimensions.get("window").width;
  useEffect(() => { api<{ product: P }>(`/products/${id}`).then((r) => setP(r.product)).catch((e) => setError(e.message)); }, [id]);
  const guard = () => { if (!user) { router.push("/login"); return false; } return true; };
  async function add() { if (!guard()) return; setError(""); setMsg(""); try {
      const cart = await api<{ items: { productId: string; quantity: number }[] }>("/cart");
      const have = cart.items.find((i) => i.productId === id)?.quantity ?? 0;
      const next = Math.min(have + qty, p?.stock ?? have + qty);
      await api("/cart/items", { method: "PUT", body: { productId: id, quantity: next } });
      setMsg(`Added to cart ✓ (${next} in cart)`);
    } catch (e) { setError((e as Error).message); } }
  async function wish() { if (!guard()) return; try { await api(`/wishlist/${id}`, { method: "PUT" }); setMsg("Saved to wishlist ♡"); } catch (e) { setError((e as Error).message); } }
  if (!p) return error ? <Text style={{ padding: 20, color: C.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  const out = p.stock <= 0;
  return (
    <ScrollView style={{ backgroundColor: C.bg }}>
      {p.images.length === 0 ? <Img label={p.name} style={{ width: w }} /> :
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>{p.images.map((im) => <Img key={im.id} uri={im.url} label={p.name} style={{ width: w }} />)}</ScrollView>}
      <View style={{ padding: 16, gap: 10 }}>
        <Text style={{ color: C.muted }}>{p.category.name} · Sold by {p.store.name}</Text>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>{p.name}</Text>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>{rupees(p.pricePaise)}{p.originalPricePaise ? <Text style={{ color: C.muted, textDecorationLine: "line-through", fontWeight: "400" }}>  {rupees(p.originalPricePaise)}</Text> : null}</Text>
        <Text style={{ color: out ? C.danger : C.ok }}>{out ? "Out of stock" : `${p.stock} available`}</Text>
        <Text style={{ lineHeight: 22 }}>{p.description}</Text>
        {!out && <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Text onPress={() => setQty(Math.max(1, qty - 1))} style={{ fontSize: 26, width: 48, height: 48, textAlign: "center", textAlignVertical: "center", borderWidth: 1, borderColor: C.line, borderRadius: 12 }}>−</Text>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>{qty}</Text>
          <Text onPress={() => setQty(Math.min(p.stock, qty + 1))} style={{ fontSize: 26, width: 48, height: 48, textAlign: "center", textAlignVertical: "center", borderWidth: 1, borderColor: C.line, borderRadius: 12 }}>+</Text></View>}
        <Btn title={out ? "Unavailable" : "Add to cart"} onPress={add} disabled={out} />
        <Btn title="♡ Wishlist" kind="ghost" onPress={wish} />
        {msg ? <Text style={{ color: C.ok }}>{msg}</Text> : null}{error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
}
