import { useState } from "react";
import { Image, StyleProp, Text, View, ViewStyle } from "react-native";
import { C } from "@/lib/theme";

// Square-cropped image with a letter fallback if the URL is missing or fails to load.
export default function Img({ uri, label, style }: { uri?: string | null; label: string; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[{ aspectRatio: 1, backgroundColor: "#f5f5f4", alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      {uri && !failed ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => setFailed(true)} />
        : <Text style={{ fontSize: 36, fontWeight: "800", color: "#a8a29e" }} accessibilityLabel="No image">{label.charAt(0).toUpperCase()}</Text>}
    </View>
  );
}
export const Btn = ({ title, onPress, disabled, kind }: { title: string; onPress: () => void; disabled?: boolean; kind?: "ghost" | "danger" }) => (
  <Text onPress={disabled ? undefined : onPress} accessibilityRole="button" style={{
    textAlign: "center", paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, fontWeight: "700", overflow: "hidden", opacity: disabled ? 0.5 : 1,
    backgroundColor: kind === "ghost" ? "transparent" : kind === "danger" ? C.danger : C.brand, color: kind === "ghost" ? C.brand : "#fff",
    borderWidth: kind === "ghost" ? 1 : 0, borderColor: C.brand,
  }}>{title}</Text>
);
