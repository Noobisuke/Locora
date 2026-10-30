import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C, rupees } from "@/lib/theme";
import { Btn } from "@/components/Img";

type O = { id: string; status: string; totalPaise: number; createdAt: string; items: unknown[] };
export default function Orders() {
  const { user, ready } = useAuth(); const router = useRouter();
  const [orders, setOrders] = useState<O[] | null>(null); const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { if (user) api<{ orders: O[] }>("/orders").then((r) => setOrders(r.orders)).catch((e) => setError(e.message)); }, [user]));
  if (!ready) return <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  if (!user) return <View style={{ padding: 20, gap: 12 }}><Text>Log in to see your orders.</Text><Btn title="Log in" onPress={() => router.push("/login")} /></View>;
  if (!orders) return error ? <Text style={{ padding: 20, color: C.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  return (
    <FlatList style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 10 }} data={orders} keyExtractor={(o) => o.id}
      ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 60, color: C.muted }}>No orders yet.</Text>}
      renderItem={({ item: o }) => (
        <Pressable onPress={() => router.push(`/order/${o.id}`)} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 4 }}>
          <Text style={{ fontWeight: "700" }}>Order #{o.id.slice(-8).toUpperCase()}</Text>
          <Text style={{ color: C.muted }}>{new Date(o.createdAt).toLocaleString("en-IN")} · {o.items.length} item(s)</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text>{o.status.replaceAll("_", " ")}</Text><Text style={{ fontWeight: "700" }}>{rupees(o.totalPaise)}</Text></View>
        </Pressable>)} />
  );
}
