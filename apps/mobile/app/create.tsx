import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  coarseCell,
  suggestCategory,
  type ListingCategory,
  type ListingCondition,
} from "@trunkjunk/shared";

const CATS: ListingCategory[] = CATEGORY_ORDER;
const CONDS: ListingCondition[] = ["new", "like_new", "good", "fair", "parts"];

export default function CreateListing() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<ListingCategory>("standard");
  const [catTouched, setCatTouched] = useState(false);
  const [cond, setCond] = useState<ListingCondition>("good");
  const [ask, setAsk] = useState("");
  const [minBid, setMinBid] = useState("");
  const [buyNow, setBuyNow] = useState("");
  const [weight, setWeight] = useState("");
  const [showCatInfo, setShowCatInfo] = useState(false);

  const catDef = CATEGORIES[cat];

  // Smart-suggest a category from title+description until the user picks one manually.
  function maybeSuggest(nextTitle: string, nextDesc: string) {
    if (catTouched) return;
    const suggestion = suggestCategory(`${nextTitle} ${nextDesc}`);
    if (suggestion && suggestion !== cat) setCat(suggestion);
  }
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function pickPhoto() {
    if (photos.length >= 5) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPhotos([...photos, { uri: a.uri, base64: a.base64! }]);
    }
  }

  async function submit() {
    if (!title.trim() || !desc.trim()) return Alert.alert("Title and description required");
    if (photos.length === 0) return Alert.alert("Add at least one photo");
    if (catDef.weightRequired && (!weight || Number(weight) <= 0)) {
      return Alert.alert(`${catDef.label} requires weight`, "Enter the approximate weight in lbs — scrap is priced by weight.");
    }

    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission required for pickup address");
      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const h3 = coarseCell(lat, lng);

      const { data: listingId, error } = await supabase.rpc("create_listing", {
        p_title: title.trim(),
        p_description: desc.trim(),
        p_category: cat,
        p_condition: cond,
        p_ask_price: ask ? Number(ask) : null,
        p_min_bid: minBid ? Number(minBid) : null,
        p_buy_now_price: buyNow ? Number(buyNow) : null,
        p_lat: lat, p_lng: lng, p_h3_r8: h3,
        p_zip3: null,
      });
      if (error || !listingId) throw error ?? new Error("Could not create listing");

      // Persist weight separately for scrap/parts pricing.
      if (weight && Number(weight) > 0) {
        await supabase
          .from("listings")
          .update({ weight_lbs: Number(weight) })
          .eq("id", listingId);
      }

      const me = (await supabase.auth.getUser()).data.user!.id;
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const key = `${me}/${listingId}/${i}.jpg`;
        const { error: uErr } = await supabase.storage
          .from("listing-media")
          .upload(key, decode(p.base64), { contentType: "image/jpeg", upsert: true });
        if (uErr) throw uErr;
        await supabase.from("listing_media").insert({
          listing_id: listingId,
          r2_key: key,
          display_order: i,
          ai_safe: true, // moderation pipeline marks final value
        });
      }

      // Activate
      await supabase.from("listings").update({ status: "active" }).eq("id", listingId);

      router.replace({ pathname: "/listing/[id]", params: { id: String(listingId) } });
    } catch (e: any) {
      Alert.alert("Could not create listing", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bg }} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(v) => { setTitle(v); maybeSuggest(v, desc); }}
        placeholder="West Elm leather sofa"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 120, textAlignVertical: "top" }]}
        value={desc}
        onChangeText={(v) => { setDesc(v); maybeSuggest(title, v); }}
        placeholder="Condition, dimensions, why you're selling…"
        multiline
      />

      <View style={styles.catHeader}>
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity onPress={() => setShowCatInfo((s) => !s)}>
          <Text style={styles.helpLink}>{showCatInfo ? "Hide guide" : "What goes here?"}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chipsRow}>
        {CATS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, c === cat && styles.chipActive]}
            onPress={() => { setCat(c); setCatTouched(true); }}
          >
            <Text style={[styles.chipText, c === cat && { color: "#fff" }]}>{CATEGORIES[c].label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.catCard}>
        <Text style={styles.catCardTitle}>{catDef.label}</Text>
        <Text style={styles.catCardShort}>{catDef.short}</Text>
        {showCatInfo && (
          <>
            <Text style={styles.catCardBody}>{catDef.description}</Text>
            <Text style={styles.catCardSubhead}>Examples</Text>
            <View style={styles.exampleRow}>
              {catDef.examples.map((ex) => (
                <View key={ex} style={styles.exampleChip}><Text style={styles.exampleText}>{ex}</Text></View>
              ))}
            </View>
            {catDef.excludes.length > 0 && (
              <>
                <Text style={styles.catCardSubhead}>Doesn't belong here</Text>
                {catDef.excludes.map((ex) => (
                  <Text key={ex} style={styles.excludeLine}>• {ex}</Text>
                ))}
              </>
            )}
          </>
        )}
        {catDef.requireSerialPhoto && (
          <Text style={styles.catFlag}>Tip: include a photo of the model/serial sticker — buyers value verifiable specs.</Text>
        )}
      </View>

      <Text style={styles.label}>Condition</Text>
      <View style={styles.chipsRow}>
        {CONDS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, c === cond && styles.chipActive]}
            onPress={() => setCond(c)}
          >
            <Text style={[styles.chipText, c === cond && { color: "#fff" }]}>{c.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {catDef.weightRequired && (
        <>
          <Text style={styles.label}>Approximate weight (lbs)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 45"
            keyboardType="decimal-pad"
          />
          <Text style={styles.note}>Scrap is priced by weight — buyers filter by lbs.</Text>
        </>
      )}

      <Text style={styles.label}>Ask price (optional)</Text>
      <TextInput style={styles.input} value={ask} onChangeText={setAsk} placeholder="350" keyboardType="decimal-pad" />

      <Text style={styles.label}>Minimum bid</Text>
      <TextInput style={styles.input} value={minBid} onChangeText={setMinBid} placeholder="100" keyboardType="decimal-pad" />

      <Text style={styles.label}>Buy-now price (optional)</Text>
      <TextInput style={styles.input} value={buyNow} onChangeText={setBuyNow} placeholder="450" keyboardType="decimal-pad" />

      <Text style={styles.label}>Photos ({photos.length}/5)</Text>
      <View style={styles.photoRow}>
        {photos.map((p, i) => (
          <Image key={i} source={{ uri: p.uri }} style={styles.thumb} />
        ))}
        {photos.length < 5 && (
          <TouchableOpacity style={[styles.thumb, styles.addBtn]} onPress={pickPhoto}>
            <Text style={{ fontSize: 24, color: Colors.muted }}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.note}>
        Your exact address is never shown publicly. Buyers see only a ~0.46 mi² area on the map until you accept a bid.
      </Text>

      <TouchableOpacity style={[styles.submit, busy && { opacity: 0.5 }]} disabled={busy} onPress={submit}>
        <Text style={styles.submitText}>{busy ? "Publishing…" : "Publish listing"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { ...Type.small, color: Colors.muted, marginTop: Spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    color: Colors.text,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.pill,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.text, fontSize: 13, fontWeight: "500" },
  catHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  helpLink: { color: Colors.primary, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  catCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  catCardTitle: { ...Type.body, color: Colors.text, fontWeight: "700" },
  catCardShort: { ...Type.caption, color: Colors.muted, marginTop: 2 },
  catCardBody: { ...Type.caption, color: Colors.text, marginTop: Spacing.sm, lineHeight: 18 },
  catCardSubhead: { ...Type.small, color: Colors.muted, marginTop: Spacing.sm, fontWeight: "600" },
  exampleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  exampleChip: {
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  exampleText: { color: Colors.text, fontSize: 12 },
  excludeLine: { ...Type.caption, color: Colors.muted, marginTop: 2 },
  catFlag: { ...Type.caption, color: Colors.primary, marginTop: Spacing.sm, fontStyle: "italic" },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  thumb: { width: 96, height: 96, borderRadius: Radii.md, backgroundColor: Colors.surfaceAlt },
  addBtn: {
    alignItems: "center", justifyContent: "center",
    borderColor: Colors.border, borderWidth: 1, borderStyle: "dashed",
  },
  note: { ...Type.caption, color: Colors.muted, marginTop: Spacing.md, lineHeight: 17 },
  submit: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radii.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
