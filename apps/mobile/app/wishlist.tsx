import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C, rupees } from "@/lib/theme";
import Img from "@/components/Img";

type P = { id: string; name: string; pricePaise: number; images: { url: string }[] };
export default function Wishlist() {
  const router = useRouter();
  const [items, setItems] = useState<P[] | null>(null); const [error, setError] = useState("");
  const load = useCallback(() => { api<{ products: P[] }>("/wishlist").then((r) => setItems(r.products)).catch((e) => setError(e.message)); }, []);
  useFocusEffect(load);
  if (!items) return error ? <Text style={{ padding: 20, color: C.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  return (
    <FlatList style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 10 }} data={items} keyExtractor={(p) => p.id}
      ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 60, color: C.muted }}>Your wishlist is empty.</Text>}
      renderItem={({ item: p }) => (
        <View style={{ flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 10, alignItems: "center" }}>
          <Pressable onPress={() => router.push(`/product/${p.id}`)} style={{ flexDirection: "row", gap: 12, flex: 1, alignItems: "center" }}>
            <Img uri={p.images[0]?.url} label={p.name} style={{ width: 72, height: 72, borderRadius: 8 }} />
            <View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }} numberOfLines={2}>{p.name}</Text><Text>{rupees(p.pricePaise)}</Text></View></Pressable>
          <Text onPress={() => api(`/wishlist/${p.id}`, { method: "DELETE" }).then(load).catch((e) => setError(e.message))} style={{ color: C.danger }}>Remove</Text>
        </View>)} />
  );
}
