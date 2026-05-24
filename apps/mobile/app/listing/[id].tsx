import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Polygon, PROVIDER_DEFAULT } from "react-native-maps";
import { supabase } from "@/lib/supabase";
import { useAuth, useLocation } from "@/lib/store";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";
import { CATEGORY_LABELS, cellPolygon, formatDistance } from "@trunkjunk/shared";

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { lat, lng } = useLocation();

  const [listing, setListing] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMsg, setBidMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("listings")
      .select(`
        id, seller_id, title, description, category, condition,
        ask_price, min_bid, buy_now_price, weight_lbs, dims_in, status,
        bid_count, view_count, pickup_h3_r8, created_at,
        seller:seller_id(display_name, trust_tier, seller_rating, seller_tx_count)
      `)
      .eq("id", id)
      .single();
    setListing(data);

    const { data: m } = await supabase
      .from("listing_media")
      .select("r2_key, display_order")
      .eq("listing_id", id)
      .order("display_order");
    setMedia(m ?? []);

    if (lat != null && lng != null) {
      const { data: d } = await supabase.rpc("listing_distance", {
        p_listing_id: id, viewer_lat: lat, viewer_lng: lng,
      });
      setDistance(typeof d === "number" ? d : null);
    }
  }, [id, lat, lng]);

  useEffect(() => { load(); }, [load]);

  const hexCoords = useMemo(() => {
    if (!listing?.pickup_h3_r8) return [];
    return cellPolygon(listing.pickup_h3_r8).map(([la, ln]) => ({ latitude: la, longitude: ln }));
  }, [listing?.pickup_h3_r8]);

  const isOwner = listing?.seller_id === session?.user.id;

  async function placeBid(buyNow: boolean) {
    if (!session?.user) return;
    const amt = Number(bidAmount || listing?.buy_now_price);
    if (!amt || amt <= 0) return Alert.alert("Enter a bid amount");
    setBusy(true);
    const { error } = await supabase.rpc("place_bid", {
      p_listing_id: id, p_amount: amt, p_message: bidMsg || null, p_buy_now: buyNow,
    });
    setBusy(false);
    if (error) return Alert.alert("Couldn't place bid", error.message);
    Alert.alert("Bid placed", "The seller will be notified.", [
      { text: "OK", onPress: () => router.push("/(tabs)/messages") },
    ]);
  }

  if (!listing) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bg }}>
      {media[0] ? (
        <Image
          source={{ uri: `${process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? ""}/${media[0].r2_key}` }}
          style={styles.hero}
        />
      ) : (
        <View style={[styles.hero, { backgroundColor: Colors.surfaceAlt }]} />
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.price}>
          {listing.ask_price != null ? `$${Number(listing.ask_price).toFixed(0)}` : "Open to bids"}
          {listing.buy_now_price != null && (
            <Text style={styles.buyNow}> · Buy now ${Number(listing.buy_now_price).toFixed(0)}</Text>
          )}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaPill}>{CATEGORY_LABELS[listing.category as keyof typeof CATEGORY_LABELS]}</Text>
          <Text style={styles.metaPill}>{listing.condition.replace("_", " ")}</Text>
          <Text style={styles.metaPill}>{formatDistance(distance)}</Text>
        </View>

        <Text style={styles.section}>About this item</Text>
        <Text style={styles.body2}>{listing.description}</Text>

        <Text style={styles.section}>Pickup area</Text>
        <Text style={styles.note}>
          Exact address is revealed only after a bid is accepted and payment is held in escrow.
        </Text>
        {hexCoords.length > 0 && (
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: hexCoords[0].latitude,
              longitude: hexCoords[0].longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            pointerEvents="none"
          >
            <Polygon
              coordinates={hexCoords}
              strokeColor={Colors.primary}
              fillColor={`${Colors.primary}33`}
              strokeWidth={2}
            />
          </MapView>
        )}

        <Text style={styles.section}>Seller</Text>
        <View style={styles.sellerRow}>
          <View style={styles.avatar}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {listing.seller?.display_name?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View>
            <Text style={{ color: Colors.text, fontWeight: "600" }}>
              {listing.seller?.display_name}
            </Text>
            <Text style={{ color: Colors.muted, fontSize: 13 }}>
              {listing.seller?.seller_rating
                ? `${Number(listing.seller.seller_rating).toFixed(1)} ★ · ${listing.seller.seller_tx_count} sales`
                : "New seller"}
            </Text>
          </View>
        </View>

        {!isOwner && (
          <View style={styles.bidBox}>
            <Text style={styles.section}>Place a bid</Text>
            <TextInput
              style={styles.input}
              placeholder={`Amount (min $${listing.min_bid ?? 1})`}
              placeholderTextColor={Colors.faint}
              keyboardType="decimal-pad"
              value={bidAmount}
              onChangeText={setBidAmount}
            />
            <TextInput
              style={[styles.input, { height: 64 }]}
              placeholder="Optional note to seller"
              placeholderTextColor={Colors.faint}
              multiline
              value={bidMsg}
              onChangeText={setBidMsg}
            />
            <TouchableOpacity
              style={[styles.btn, busy && { opacity: 0.5 }]}
              onPress={() => placeBid(false)}
              disabled={busy}
            >
              <Text style={styles.btnText}>Submit bid</Text>
            </TouchableOpacity>
            {listing.buy_now_price != null && (
              <TouchableOpacity
                style={[styles.btn, styles.btnGold]}
                onPress={() => placeBid(true)}
                disabled={busy}
              >
                <Text style={styles.btnText}>Buy now · ${Number(listing.buy_now_price).toFixed(0)}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.note}>
              Bids expire in 48 hours. Payment is held in escrow until pickup is confirmed by both
              parties with a 6-digit code.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 280 },
  body: { padding: Spacing.lg },
  title: { ...Type.title, color: Colors.text },
  price: { ...Type.title, color: Colors.primary, marginTop: 4 },
  buyNow: { ...Type.body, color: Colors.muted },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.sm },
  metaPill: {
    backgroundColor: Colors.surfaceAlt,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    fontSize: 12,
    color: Colors.text,
  },
  section: { ...Type.heading, color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  body2: { ...Type.body, color: Colors.text, lineHeight: 22 },
  note: { ...Type.caption, color: Colors.muted, marginTop: Spacing.xs, lineHeight: 17 },
  map: {
    width: "100%",
    height: 200,
    borderRadius: Radii.md,
    marginTop: Spacing.sm,
  },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  bidBox: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.lg,
  },
  input: {
    backgroundColor: Colors.bg,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  btn: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radii.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  btnGold: { backgroundColor: Colors.gold },
  btnText: { color: "#fff", fontWeight: "700" },
});
