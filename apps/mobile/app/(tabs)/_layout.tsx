import { Tabs } from "expo-router";
import { C } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.brand, headerTintColor: C.brand, tabBarLabelStyle: { fontSize: 13, paddingBottom: 4 } }}>
      <Tabs.Screen name="index" options={{ title: "Home", headerTitle: "Locora" }} />
      <Tabs.Screen name="cart" options={{ title: "Cart" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
