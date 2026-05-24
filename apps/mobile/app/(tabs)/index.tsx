import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { useRouter, Link } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useEnsureLocation } from "@/hooks/useLocation";
import { useLocation } from "@/lib/store";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";
import { CATEGORY_LABELS, formatDistance, type Listing, type ListingCategory } from "@trunkjunk/shared";

const CATEGORIES: (ListingCategory | null)[] = [
  null,
  "furniture",
  "electronics",
  "appliance",
  "tools",
  "fitness",
  "home_goods",
];

export default function Feed() {
  useEnsureLocation();
  const router = useRouter();
  const { lat, lng } = useLocation();
  const [items, setItems] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState<ListingCategory | null>(null);

  const load = useCallback(async () => {
    if (lat == null || lng == null) return;
    setRefreshing(true);
    const { data, error } = await supabase.rpc("listings_feed", {
      viewer_lat: lat,
      viewer_lng: lng,
      radius_mi: 25,
      in_category: cat,
      limit_n: 50,
    });
    setRefreshing(false);
    if (error) return console.warn(error.message);
    setItems((data ?? []) as Listing[]);
  }, [lat, lng, cat]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.h1}>Find your next find</Text>
        <Link href="/create" asChild>
          <TouchableOpacity style={styles.fab}>
            <MaterialCommunityIcons name="plus" size={22} color="#fff" />
            <Text style={styles.fabText}>List</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View style={styles.chips}>
        <FlashList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          estimatedItemSize={100}
          renderItem={({ item }) => {
            const active = item === cat;
            return (
              <TouchableOpacity
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCat(item)}
              >
                <Text style={[styles.chipText, active && { color: "#fff" }]}>
                  {item ? CATEGORY_LABELS[item] : "All"}
                </Text>
              </TouchableOpacity>
            );
          }}
          keyExtractor={(i) => i ?? "all"}
        />
      </View>

      <FlashList
        data={items}
        estimatedItemSize={220}
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          <View style={{ padding: Spacing.xxl, alignItems: "center" }}>
            <MaterialCommunityIcons name="magnify" size={48} color={Colors.faint} />
            <Text style={{ color: Colors.muted, marginTop: Spacing.md }}>
              Nothing nearby yet. Be the first to list.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: "/listing/[id]", params: { id: item.id } })}
          >
            <Image
              source={
                item.thumbnail_key
                  ? { uri: `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? ""}/${item.thumbnail_key}` }
                  : require("../../assets/placeholder.png")
              }
              style={styles.thumb}
              contentFit="cover"
            />
            <View style={styles.cardBody}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={styles.row}>
                <Text style={styles.price}>
                  {item.ask_price != null ? `$${Number(item.ask_price).toFixed(0)}` : "Bids only"}
                </Text>
                <Text style={styles.distance}>{formatDistance(item.distance_mi ?? null)}</Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {CATEGORY_LABELS[item.category]} · {item.condition.replace("_", " ")}
                {item.bid_count > 0 ? ` · ${item.bid_count} bid${item.bid_count === 1 ? "" : "s"}` : ""}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { ...Type.title, color: Colors.text },
  fab: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fabText: { color: "#fff", fontWeight: "700" },
  chips: { height: 48, paddingHorizontal: Spacing.lg },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.pill,
    marginRight: Spacing.sm,
    height: 32,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.text, fontSize: 13, fontWeight: "500" },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  thumb: { width: "100%", height: 180, backgroundColor: Colors.surfaceAlt },
  cardBody: { padding: Spacing.md },
  title: { ...Type.heading, color: Colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  price: { ...Type.heading, color: Colors.primary },
  distance: { ...Type.small, color: Colors.muted },
  meta: { ...Type.caption, color: Colors.muted, marginTop: 4 },
});
