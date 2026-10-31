import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { getHint, setHint } from "@/lib/verifyHint";
import { C } from "@/lib/theme";
import { Btn } from "@/components/Img";

const mask = (e: string) => { const [u, d] = e.split("@"); return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`; };

export default function Screen() {
  const { verifyEmail, resendCode } = useAuth();
  const router = useRouter();
  const email = String(useLocalSearchParams<{ email: string }>().email ?? "").toLowerCase();
  const [code, setCode] = useState("");
  const [error, setError] = useState(""); const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const h = getHint(email);
    if (h) { setDevCode(h.devCode); setLeft(Math.max(0, Math.ceil((h.resendAt - Date.now()) / 1000))); }
  }, [email]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function submit(c: string) {
    if (busy || c.length !== 6) return;
    setBusy(true); setError(""); setInfo("");
    try { await verifyEmail(email, c); router.replace("/"); }
    catch (e) { setError((e as Error).message); setBusy(false); setCode(""); }
  }
  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submit(digits);
  }
  async function resend() {
    setError(""); setInfo("");
    try {
      const r = await resendCode(email);
      setHint({ email, devCode: r.devCode, resendIn: r.resendIn });
      setDevCode(r.devCode); setLeft(r.resendIn ?? 60);
      setInfo(r.resendIn ? `Please wait ${r.resendIn}s before asking for another code.` : "A new code has been sent.");
    } catch (e) { setError((e as Error).message); }
  }

  if (!email) return <View style={{ padding: 20, gap: 12 }}><Text style={{ color: C.muted }}>Start by creating an account.</Text><Btn title="Create account" onPress={() => router.replace("/register")} /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" style={{ backgroundColor: C.bg }}>
      <Text style={{ fontSize: 26, fontWeight: "800", color: C.brand }}>Check your email</Text>
      <Text style={{ color: C.muted }}>We sent a 6-digit code to {mask(email)}. It expires in 10 minutes. Not there? Check your spam folder.</Text>
      {devCode ? <Text style={{ backgroundColor: "#fef3c7", padding: 12, borderRadius: 12 }} onPress={() => onChange(devCode)}>Development mode: no email was sent. Your code is {devCode} (tap to use it).</Text> : null}
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      {info ? <Text style={{ color: C.ok }}>{info}</Text> : null}
      <TextInput value={code} onChangeText={onChange} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} placeholder="••••••" autoFocus
        style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 12, height: 60, textAlign: "center", fontSize: 28, letterSpacing: 10, fontWeight: "700" }} />
      <Btn title={busy ? "Checking…" : "Verify and continue"} disabled={busy || code.length !== 6} onPress={() => submit(code)} />
      <Btn title={left > 0 ? `Resend code in ${left}s` : "Resend code"} kind="ghost" disabled={left > 0} onPress={resend} />
      <Text style={{ color: C.brand, textAlign: "center" }} onPress={() => router.replace("/register")}>Use a different email</Text>
    </ScrollView>
  );
}
