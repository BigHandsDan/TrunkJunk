import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/store";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";
import { TIER_COLORS, TIER_LABELS, feePct, type Profile } from "@trunkjunk/shared";

export default function ProfileTab() {
  const { session } = useAuth();
  const [me, setMe] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, trust_tier, trust_score, seller_rating, buyer_rating, seller_tx_count, buyer_tx_count, phone_verified, email_verified, id_verified",
      )
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setMe(data as Profile));
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!me) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <Text style={{ padding: Spacing.lg, color: Colors.muted }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 28, fontWeight: "700", color: "#fff" }}>
              {me.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{me.display_name}</Text>
          <View style={[styles.tier, { backgroundColor: TIER_COLORS[me.trust_tier] }]}>
            <Text style={styles.tierText}>{TIER_LABELS[me.trust_tier]}</Text>
          </View>
          <Text style={styles.fee}>Platform fee at your tier: {feePct(me.trust_tier)}</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label="As seller" stars={me.seller_rating} count={me.seller_tx_count} />
          <Stat label="As buyer" stars={me.buyer_rating} count={me.buyer_tx_count} />
        </View>

        <Text style={styles.section}>Verification</Text>
        <Row
          icon="phone-check"
          label="Phone"
          done={me.phone_verified}
          action={async () => Alert.alert("Already verified via sign-in")}
        />
        <Row
          icon="email-check-outline"
          label="Email"
          done={me.email_verified}
          action={async () => Alert.alert("Coming soon", "Email verify flow lives in Sprint 1.")}
        />
        <Row
          icon="card-account-details-outline"
          label="Government ID"
          done={me.id_verified}
          action={async () => Alert.alert("Coming soon", "Stripe Identity flow lives in Sprint 6.")}
        />

        <TouchableOpacity style={styles.signOut} onPress={signOut}>
          <Text style={{ color: Colors.error, fontWeight: "600" }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, stars, count }: { label: string; stars: number | null; count: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {stars ? `${Number(stars).toFixed(1)} ★` : "—"}{" "}
        <Text style={{ color: Colors.muted, fontSize: 13 }}>({count})</Text>
      </Text>
    </View>
  );
}

function Row({
  icon, label, done, action,
}: { icon: any; label: string; done: boolean; action: () => Promise<void> }) {
  return (
    <TouchableOpacity onPress={action} style={styles.verifyRow}>
      <MaterialCommunityIcons name={icon} size={22} color={done ? Colors.success : Colors.muted} />
      <Text style={{ flex: 1, marginLeft: Spacing.md, color: Colors.text }}>{label}</Text>
      <Text style={{ color: done ? Colors.success : Colors.primary }}>{done ? "Verified" : "Verify"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  name: { ...Type.title, color: Colors.text, marginTop: Spacing.md },
  tier: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    marginTop: Spacing.sm,
  },
  tierText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  fee: { ...Type.caption, color: Colors.muted, marginTop: Spacing.sm },

  statsRow: { flexDirection: "row", marginTop: Spacing.lg, gap: Spacing.md },
  stat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  statLabel: { ...Type.caption, color: Colors.muted },
  statValue: { ...Type.heading, color: Colors.text, marginTop: 4 },

  section: { ...Type.heading, color: Colors.text, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderColor: Colors.border,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  signOut: {
    alignItems: "center",
    padding: Spacing.lg,
    marginTop: Spacing.xxl,
  },
});
