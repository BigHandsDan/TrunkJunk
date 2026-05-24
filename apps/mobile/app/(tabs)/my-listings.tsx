import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Link } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/store";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";
import { CATEGORY_LABELS } from "@trunkjunk/shared";

interface Row {
  id: string;
  title: string;
  status: string;
  category: keyof typeof CATEGORY_LABELS;
  ask_price: number | null;
  bid_count: number;
  view_count: number;
  created_at: string;
}

export default function MyListings() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setRefreshing(true);
    const { data } = await supabase
      .from("listings")
      .select("id,title,status,category,ask_price,bid_count,view_count,created_at")
      .eq("seller_id", session.user.id)
      .order("created_at", { ascending: false });
    setRefreshing(false);
    setItems((data ?? []) as Row[]);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.h1}>My listings</Text>
        <Link href="/create" asChild>
          <TouchableOpacity style={styles.fab}>
            <MaterialCommunityIcons name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </Link>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={{ padding: Spacing.lg }}
        ListEmptyComponent={
          <View style={{ padding: Spacing.xxl, alignItems: "center" }}>
            <Text style={{ color: Colors.muted }}>You haven't listed anything yet.</Text>
            <Link href="/create" style={{ color: Colors.primary, marginTop: Spacing.md }}>
              Create your first listing
            </Link>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {CATEGORY_LABELS[item.category]} · {item.status} ·{" "}
                {item.bid_count} bid{item.bid_count === 1 ? "" : "s"} · {item.view_count} views
              </Text>
            </View>
            <Text style={styles.price}>
              {item.ask_price != null ? `$${Number(item.ask_price).toFixed(0)}` : "—"}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { ...Type.title, color: Colors.text },
  fab: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  title: { ...Type.heading, color: Colors.text },
  meta: { ...Type.caption, color: Colors.muted, marginTop: 2 },
  price: { ...Type.heading, color: Colors.primary, marginLeft: Spacing.md },
});
