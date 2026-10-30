import { Stack } from "expo-router";
import { AuthProvider } from "@/lib/auth";
import { C } from "@/lib/theme";

export default function Root() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerTintColor: C.brand }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: "Product" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="order/[id]" options={{ title: "Order" }} />
        <Stack.Screen name="wishlist" options={{ title: "Wishlist" }} />
        <Stack.Screen name="addresses" options={{ title: "Saved addresses" }} />
        <Stack.Screen name="login" options={{ title: "Log in" }} />
        <Stack.Screen name="register" options={{ title: "Create account" }} />
      </Stack>
    </AuthProvider>
  );
}
