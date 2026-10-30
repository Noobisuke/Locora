import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C, rupees } from "@/lib/theme";
import { Btn } from "@/components/Img";

type Addr = { id: string; label: string; line1: string; line2: string | null; city: string; state: string; pincode: string; phone: string; isDefault: boolean };
type Cart = { items: { productId: string; name: string; quantity: number; linePaise: number }[]; deliveryFeePaise: number; totalPaise: number };
const blank = { label: "Home", line1: "", city: "", state: "Punjab", pincode: "", phone: "" };

export default function Checkout() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null); const [addrs, setAddrs] = useState<Addr[]>([]); const [sel, setSel] = useState(""); const [adding, setAdding] = useState(false);
  const [f, setF] = useState(blank); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const key = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`); // same key on retry = no duplicate order
  useEffect(() => {
    api<Cart>("/cart").then(setCart).catch((e) => setError(e.message));
    api<{ addresses: Addr[] }>("/addresses").then((r) => { setAddrs(r.addresses); setSel(r.addresses.find((a) => a.isDefault)?.id ?? r.addresses[0]?.id ?? ""); setAdding(r.addresses.length === 0); }).catch((e) => setError(e.message));
  }, []);
  async function saveAddr() {
    setError("");
    try { const r = await api<{ address: Addr }>("/addresses", { method: "POST", body: f }); setAddrs([r.address, ...addrs]); setSel(r.address.id); setAdding(false); setF(blank); } catch (e) { setError((e as Error).message); }
  }
  async function place() {
    setBusy(true); setError("");
    try { const r = await api<{ order: { id: string } }>("/orders", { method: "POST", body: { addressId: sel, paymentMethod: "COD", idempotencyKey: key.current } }); router.replace(`/order/${r.order.id}`); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  if (!cart) return error ? <Text style={{ padding: 20, color: C.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  const inp = { backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, height: 48 } as const;
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 12 }} keyboardShouldPersistTaps="handled">
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      <Text style={{ fontSize: 18, fontWeight: "800" }}>Delivery address</Text>
      {addrs.map((a) => (
        <Pressable key={a.id} onPress={() => setSel(a.id)} style={{ backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 2, borderColor: sel === a.id ? C.brand : "transparent" }}>
          <Text style={{ fontWeight: "700" }}>{a.label}</Text><Text>{a.line1}, {a.city} {a.pincode}</Text><Text style={{ color: C.muted }}>{a.phone}</Text></Pressable>))}
      {!adding ? <Btn title="+ Add new address" kind="ghost" onPress={() => setAdding(true)} /> : (
        <View style={{ gap: 8 }}>
          <TextInput style={inp} placeholder="Label (Home, Work)" value={f.label} onChangeText={(v) => setF({ ...f, label: v })} />
          <TextInput style={inp} placeholder="Address" value={f.line1} onChangeText={(v) => setF({ ...f, line1: v })} />
          <TextInput style={inp} placeholder="City" value={f.city} onChangeText={(v) => setF({ ...f, city: v })} />
          <TextInput style={inp} placeholder="State" value={f.state} onChangeText={(v) => setF({ ...f, state: v })} />
          <TextInput style={inp} placeholder="Pincode (6 digits)" keyboardType="number-pad" value={f.pincode} onChangeText={(v) => setF({ ...f, pincode: v })} />
          <TextInput style={inp} placeholder="Phone" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
          <Btn title="Save address" onPress={saveAddr} /></View>)}
      <Text style={{ fontSize: 18, fontWeight: "800" }}>Summary</Text>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 6 }}>
        {cart.items.map((i) => <View key={i.productId} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ flex: 1 }}>{i.name} × {i.quantity}</Text><Text>{rupees(i.linePaise)}</Text></View>)}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text>Delivery</Text><Text>{cart.deliveryFeePaise ? rupees(cart.deliveryFeePaise) : "Free"}</Text></View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontWeight: "800" }}>Total</Text><Text style={{ fontWeight: "800" }}>{rupees(cart.totalPaise)}</Text></View>
        <Text style={{ color: C.muted, marginTop: 6 }}>Payment: Cash on delivery. (Online payment is available on the website only for now.)</Text>
      </View>
      <Btn title={busy ? "Placing order…" : "Place order"} disabled={busy || !sel} onPress={place} />
    </ScrollView>
  );
}
