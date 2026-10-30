import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import { C, rupees } from "@/lib/theme";
import { Btn } from "@/components/Img";

type O = { id: string; status: string; subtotalPaise: number; deliveryFeePaise: number; totalPaise: number; items: { id: string; productName: string; unitPricePaise: number; quantity: number }[];
  payments: { method: string; status: string }[]; address: { line1: string; city: string; pincode: string; phone: string }; fulfillments: { id: string; status: string; store: { name: string }; delivery: { status: string } | null }[] };

export default function Order() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [o, setO] = useState<O | null>(null); const [error, setError] = useState("");
  useEffect(() => { api<{ order: O }>(`/orders/${id}`).then((r) => setO(r.order)).catch((e) => setError(e.message)); }, [id]);
  const cancel = () => Alert.alert("Cancel order?", "This cannot be undone.", [{ text: "No" }, { text: "Yes, cancel", style: "destructive", onPress: async () => {
    try { setO((await api<{ order: O }>(`/orders/${id}/cancel`, { method: "POST" })).order); } catch (e) { setError((e as Error).message); } } }]);
  if (!o) return error ? <Text style={{ padding: 20, color: C.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "800" }}>Order #{o.id.slice(-8).toUpperCase()}</Text>
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 4 }}>
        <Text style={{ fontWeight: "700" }}>Status: {o.status.replaceAll("_", " ")}</Text>
        <Text style={{ color: C.muted }}>Payment: {o.payments[0]?.method} — {o.payments[0]?.status}</Text>
        {o.fulfillments.map((f) => <Text key={f.id} style={{ color: C.muted }}>{f.store.name}: {f.status.replaceAll("_", " ")}{f.delivery ? ` · delivery ${f.delivery.status}` : ""}</Text>)}</View>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 4 }}>
        {o.items.map((i) => <View key={i.id} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ flex: 1 }}>{i.productName} × {i.quantity}</Text><Text>{rupees(i.unitPricePaise * i.quantity)}</Text></View>)}
        <Text>Delivery: {o.deliveryFeePaise ? rupees(o.deliveryFeePaise) : "Free"}</Text><Text style={{ fontWeight: "800" }}>Total: {rupees(o.totalPaise)}</Text></View>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}><Text style={{ fontWeight: "700" }}>Deliver to</Text><Text style={{ color: C.muted }}>{o.address.line1}, {o.address.city} {o.address.pincode} · {o.address.phone}</Text></View>
      {o.status === "PENDING" && o.payments[0]?.status !== "SUCCESS" && <Btn title="Cancel order" kind="danger" onPress={cancel} />}
    </ScrollView>
  );
}
