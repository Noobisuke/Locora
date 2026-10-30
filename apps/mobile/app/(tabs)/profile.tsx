import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { C } from "@/lib/theme";
import { Btn } from "@/components/Img";

export default function Profile() {
  const { user, logout } = useAuth(); const router = useRouter();
  if (!user) return <View style={{ padding: 20, gap: 12 }}><Text>You are not logged in.</Text><Btn title="Log in" onPress={() => router.push("/login")} /><Btn title="Create account" kind="ghost" onPress={() => router.push("/register")} /></View>;
  return (
    <View style={{ padding: 20, gap: 12, backgroundColor: C.bg, flex: 1 }}>
      <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}><Text style={{ fontWeight: "800", fontSize: 18 }}>{user.name}</Text><Text style={{ color: C.muted }}>{user.email} · {user.role}</Text></View>
      {user.role !== "CUSTOMER" && <Text style={{ color: C.muted }}>Seller, admin and delivery tools are on the Locora website. They are not in the mobile app yet.</Text>}
      {user.role === "CUSTOMER" && <Text style={{ color: C.muted }}>Want to sell? Apply via “Become a Seller” on the Locora website (not in the mobile app yet).</Text>}
      <Btn title="My wishlist" kind="ghost" onPress={() => router.push("/wishlist")} />
      <Btn title="Saved addresses" kind="ghost" onPress={() => router.push("/addresses")} />
      <Btn title="Log out" kind="danger" onPress={async () => { await logout(); router.replace("/"); }} />
    </View>
  );
}
