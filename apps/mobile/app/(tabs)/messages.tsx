import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { formatDistanceToNowStrict } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/store";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";

interface ThreadRow {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  state: string;
  last_message_at: string | null;
  unread_seller: number;
  unread_buyer: number;
  listings: { title: string } | null;
  seller: { display_name: string } | null;
  buyer: { display_name: string } | null;
}

export default function Messages() {
  const { session } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ThreadRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setRefreshing(true);
    const { data } = await supabase
      .from("threads")
      .select(`
        id, listing_id, seller_id, buyer_id, state, last_message_at,
        unread_seller, unread_buyer,
        listings:listing_id(title),
        seller:seller_id(display_name),
        buyer:buyer_id(display_name)
      `)
      .or(`seller_id.eq.${session.user.id},buyer_id.eq.${session.user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    setRefreshing(false);
    setItems((data ?? []) as unknown as ThreadRow[]);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("threads-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "threads" }, load)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [load]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Text style={styles.h1}>Messages</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={{ padding: Spacing.lg }}
        ListEmptyComponent={
          <View style={{ padding: Spacing.xxl, alignItems: "center" }}>
            <Text style={{ color: Colors.muted }}>No conversations yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSeller = session!.user.id === item.seller_id;
          const other = isSeller ? item.buyer?.display_name : item.seller?.display_name;
          const unread = isSeller ? item.unread_seller : item.unread_buyer;
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push({ pathname: "/thread/[id]", params: { id: item.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.listings?.title ?? "Listing"}</Text>
                <Text style={styles.meta}>
                  with {other ?? "—"} ·{" "}
                  {item.last_message_at
                    ? formatDistanceToNowStrict(new Date(item.last_message_at)) + " ago"
                    : "no messages"}
                </Text>
              </View>
              {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { ...Type.title, color: Colors.text, padding: Spacing.lg, paddingBottom: 0 },
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
  badge: {
    backgroundColor: Colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.md,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
