import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C, rupees } from "@/lib/theme";
import Img from "@/components/Img";

type P = { id: string; name: string; pricePaise: number; originalPricePaise: number | null; stock: number; images: { url: string }[]; store: { name: string } };

export default function Home() {
  const router = useRouter();
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [cat, setCat] = useState(""); const [q, setQ] = useState("");
  const [items, setItems] = useState<P[] | null>(null); const [error, setError] = useState(""); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const qs = new URLSearchParams({ sort: "newest", pageSize: "40" }); if (cat) qs.set("category", cat); if (q.trim()) qs.set("q", q.trim());
      setItems((await api<{ products: P[] }>(`/products?${qs}`)).products);
    } catch (e) { setError((e as Error).message); setItems([]); }
  }, [cat, q]);
  useEffect(() => { api<{ categories: typeof cats }>("/categories").then((r) => setCats(r.categories)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 12, gap: 8 }}>
        <Text style={{ color: C.muted }}>Everything Around You, Your City, Your Store.</Text>
        <TextInput placeholder="Search products near you" value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={load}
          style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, height: 48 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ id: "", name: "All", slug: "" }, ...cats].map((c) => (
            <Pressable key={c.id || "all"} onPress={() => setCat(c.slug)} style={{ paddingHorizontal: 14, height: 40, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: cat === c.slug ? C.brand : C.line, backgroundColor: cat === c.slug ? C.brand : "#fff" }}>
              <Text style={{ color: cat === c.slug ? "#fff" : C.ink }}>{c.name}</Text></Pressable>))}
        </ScrollView>
      </View>
      {error ? <Text style={{ color: C.danger, padding: 12 }}>{error}</Text> : null}
      {!items ? <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} /> : (
        <FlatList data={items} numColumns={2} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 8 }} refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          ListEmptyComponent={error ? undefined : <Text style={{ textAlign: "center", color: C.muted, marginTop: 40 }}>No products found.</Text>}
          renderItem={({ item: p }) => (
            <Pressable onPress={() => router.push(`/product/${p.id}`)} style={{ flex: 1, margin: 4, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", elevation: 2 }}>
              <Img uri={p.images[0]?.url} label={p.name} />
              <View style={{ padding: 10, gap: 2 }}>
                <Text numberOfLines={2} style={{ fontWeight: "600", color: C.ink }}>{p.name}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>{p.store.name}</Text>
                <Text style={{ fontWeight: "700" }}>{rupees(p.pricePaise)}{p.originalPricePaise ? <Text style={{ color: C.muted, textDecorationLine: "line-through", fontWeight: "400" }}>  {rupees(p.originalPricePaise)}</Text> : null}</Text>
                <Text style={{ color: p.stock > 0 ? C.ok : C.danger, fontSize: 12 }}>{p.stock > 0 ? (p.stock <= 5 ? `Only ${p.stock} left` : "In stock") : "Out of stock"}</Text>
              </View>
            </Pressable>)} />)}
    </View>
  );
}
