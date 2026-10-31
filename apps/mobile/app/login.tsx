import { useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { setHint } from "@/lib/verifyHint";
import { C } from "@/lib/theme";
import { Btn } from "@/components/Img";

export default function Screen() {
  const { login } = useAuth(); const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError("");
    try { await login(email.trim(), password); router.replace("/"); }
    catch (e) {
      if (e instanceof ApiError && e.data.code === "EMAIL_NOT_VERIFIED") { // server already emailed a fresh code
        const addr = e.data.email ?? email.trim();
        setHint({ email: addr, devCode: e.data.devCode, resendIn: e.data.resendIn });
        router.replace({ pathname: "/verify", params: { email: addr } });
        return;
      }
      setError((e as Error).message); setBusy(false);
    }
  }
  const inp = { backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, height: 48 } as const;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" style={{ backgroundColor: C.bg }}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: C.brand }}>Locora</Text>
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
            <TextInput style={inp} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={inp} autoComplete="password" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Btn title={busy ? "Please wait…" : "Log in"} disabled={busy} onPress={submit} />
      <Text style={{ color: C.brand, textAlign: "center" }} onPress={() => router.replace("/register")}>New here? Create an account</Text>
    </ScrollView>
  );
}
