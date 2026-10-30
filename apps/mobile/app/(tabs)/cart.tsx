import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { C, rupees } from "@/lib/theme";
import Img, { Btn } from "@/components/Img";

type Cart = { items: { productId: string; name: string; image: string | null; store: { name: string }; unitPricePaise: number; quantity: number; problem: string | null }[]; subtotalPaise: number; deliveryFeePaise: number; totalPaise: number };

export default function CartScreen() {
  const { user, ready } = useAuth(); const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null); const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { if (user) api<Cart>("/cart").then(setCart).catch((e) => setError(e.message)); }, [user]));
  const setQty = async (productId: string, quantity: number) => { setError(""); try { setCart(await api<Cart>("/cart/items", { method: "PUT", body: { productId, quantity } })); } catch (e) { setError((e as Error).message); } };
  if (!ready) return <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  if (!user) return <View style={{ padding: 20, gap: 12 }}><Text>Log in to see your cart.</Text><Btn title="Log in" onPress={() => router.push("/login")} /></View>;
  if (!cart) return error ? <Text style={{ padding: 20, color: C.danger }}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  if (cart.items.length === 0) return <View style={{ padding: 20, gap: 12, alignItems: "stretch" }}><Text style={{ textAlign: "center", marginTop: 40, color: C.muted }}>Your cart is empty.</Text><Btn title="Browse products" kind="ghost" onPress={() => router.push("/")} /></View>;
  const blocked = cart.items.some((i) => i.problem);
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 12, gap: 12 }}>
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      {cart.items.map((i) => (
        <View key={i.productId} style={{ flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 10, alignItems: "center" }}>
          <Img uri={i.image} label={i.name} style={{ width: 72, height: 72, borderRadius: 8 }} />
          <View style={{ flex: 1 }}><Text style={{ fontWeight: "600" }} numberOfLines={2}>{i.name}</Text><Text style={{ color: C.muted }}>{i.store.name} · {rupees(i.unitPricePaise)}</Text>
            {i.problem ? <Text style={{ color: C.danger }}>{i.problem}</Text> : null}</View>
          <View style={{ alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text onPress={() => setQty(i.productId, i.quantity - 1)} style={{ fontSize: 24, width: 40, height: 40, textAlign: "center", textAlignVertical: "center", borderWidth: 1, borderColor: C.line, borderRadius: 10 }}>−</Text>
              <Text style={{ fontWeight: "700" }}>{i.quantity}</Text>
              <Text onPress={() => setQty(i.productId, i.quantity + 1)} style={{ fontSize: 24, width: 40, height: 40, textAlign: "center", textAlignVertical: "center", borderWidth: 1, borderColor: C.line, borderRadius: 10 }}>+</Text></View>
            <Text onPress={() => setQty(i.productId, 0)} style={{ color: C.danger, marginTop: 6 }}>Remove</Text></View>
        </View>))}
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 6 }}>
        <Row a="Subtotal" b={rupees(cart.subtotalPaise)} /><Row a="Delivery" b={cart.deliveryFeePaise ? rupees(cart.deliveryFeePaise) : "Free"} /><Row a="Total" b={rupees(cart.totalPaise)} bold />
        {blocked ? <Text style={{ color: C.danger }}>Fix or remove unavailable items first.</Text> : null}
        <Btn title="Checkout" disabled={blocked} onPress={() => router.push("/checkout")} />
        <Text style={{ color: C.muted, fontSize: 12 }}>The server confirms the final amount when you place the order.</Text>
      </View>
    </ScrollView>
  );
}
const Row = ({ a, b, bold }: { a: string; b: string; bold?: boolean }) => <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontWeight: bold ? "800" : "400" }}>{a}</Text><Text style={{ fontWeight: bold ? "800" : "600" }}>{b}</Text></View>;
