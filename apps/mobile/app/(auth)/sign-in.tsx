import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";

export default function SignIn() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) return Alert.alert("Could not send code", error.message);
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setBusy(false);
    if (error) return Alert.alert("Could not verify", error.message);
    // AuthGate handles redirect
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.body}>
          <Text style={styles.hero}>TrunkJunk</Text>
          <Text style={styles.sub}>Turn what you'd throw away into cash.</Text>

          {step === "phone" ? (
            <>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 305 555 0123"
                placeholderTextColor={Colors.faint}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.btn, busy && { opacity: 0.6 }]}
                disabled={busy}
                onPress={sendCode}
              >
                <Text style={styles.btnText}>{busy ? "Sending…" : "Send code"}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Enter the 6-digit code</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={Colors.faint}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.btn, busy && { opacity: 0.6 }]}
                disabled={busy}
                onPress={verify}
              >
                <Text style={styles.btnText}>{busy ? "Verifying…" : "Verify"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep("phone")}>
                <Text style={styles.linkSub}>Use a different number</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.legal}>
            By continuing, you agree to TrunkJunk's Terms and Privacy Policy. Your phone number is
            verified once and never shown to other users.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  body: { flex: 1, padding: Spacing.xl, justifyContent: "center" },
  hero: { ...Type.hero, color: Colors.text, marginBottom: Spacing.xs },
  sub: { ...Type.body, color: Colors.muted, marginBottom: Spacing.xxl },
  label: { ...Type.small, color: Colors.muted, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  btn: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radii.md,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  linkSub: { color: Colors.primary, marginTop: Spacing.md, textAlign: "center" },
  legal: {
    ...Type.caption,
    color: Colors.muted,
    marginTop: Spacing.xxl,
    textAlign: "center",
    lineHeight: 18,
  },
});
