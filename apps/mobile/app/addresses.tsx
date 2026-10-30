import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/lib/theme";

type A = { id: string; label: string; line1: string; city: string; pincode: string; phone: string; isDefault: boolean };
export default function Addresses() {
  const [items, setItems] = useState<A[] | null>(null); const [error, setError] = useState("");
  const load = useCallback(() => { api<{ addresses: A[] }>("/addresses").then((r) => setItems(r.addresses)).catch((e) => setError(e.message)); }, []);
  useFocusEffect(load);
  const del = (id: string) => Alert.alert("Delete address?", "", [{ text: "No" }, { text: "Delete", style: "destructive", onPress: () => api(`/addresses/${id}`, { method: "DELETE" }).then(load).catch((e) => setError(e.message)) }]);
  if (!items) return error ? <Text style={{ padding: 20, color: C.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  return (
    <FlatList style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 10 }} data={items} keyExtractor={(a) => a.id}
      ListHeaderComponent={<Text style={{ color: C.muted }}>New addresses are added at checkout.{error ? ` ${error}` : ""}</Text>}
      ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 60, color: C.muted }}>No saved addresses.</Text>}
      renderItem={({ item: a }) => (
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 2 }}>
          <Text style={{ fontWeight: "700" }}>{a.label}{a.isDefault ? "  (default)" : ""}</Text><Text>{a.line1}, {a.city} {a.pincode}</Text><Text style={{ color: C.muted }}>{a.phone}</Text>
          <Text onPress={() => del(a.id)} style={{ color: C.danger, marginTop: 6 }}>Delete</Text></View>)} />
  );
}
