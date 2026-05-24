import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView,
} from "react-native";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";
import type { ListingCategory, ListingCondition } from "@trunkjunk/shared";

export type FeedFilters = {
  conditions: ListingCondition[];
  minPrice: string;
  maxPrice: string;
  minLbs: string;
  maxLbs: string;
  radiusMi: number;
  sortBy: "newest" | "nearest" | "price_asc" | "price_desc" | "weight_desc";
};

export const DEFAULT_FILTERS: FeedFilters = {
  conditions: [],
  minPrice: "",
  maxPrice: "",
  minLbs: "",
  maxLbs: "",
  radiusMi: 25,
  sortBy: "newest",
};

const ALL_CONDITIONS: ListingCondition[] = ["new", "like_new", "good", "fair", "parts"];
const RADII = [5, 10, 25, 50, 100];

const SORTS: { key: FeedFilters["sortBy"]; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "nearest", label: "Nearest" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "weight_desc", label: "Heaviest" },
];

export function FilterSheet({
  visible,
  category,
  filters,
  onApply,
  onClose,
}: {
  visible: boolean;
  category: ListingCategory | null;
  filters: FeedFilters;
  onApply: (f: FeedFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FeedFilters>(filters);
  const showWeight = category === "scrap" || category === "parts";
  const showSortWeight = showWeight;

  function toggleCondition(c: ListingCondition) {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.includes(c)
        ? d.conditions.filter((x) => x !== c)
        : [...d.conditions, c],
    }));
  }

  function reset() {
    setDraft(DEFAULT_FILTERS);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={reset}><Text style={styles.reset}>Reset</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: Spacing.md }}>
            <Text style={styles.label}>Sort by</Text>
            <View style={styles.row}>
              {SORTS.filter((s) => s.key !== "weight_desc" || showSortWeight).map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  active={draft.sortBy === s.key}
                  onPress={() => setDraft({ ...draft, sortBy: s.key })}
                />
              ))}
            </View>

            <Text style={styles.label}>Distance</Text>
            <View style={styles.row}>
              {RADII.map((r) => (
                <Chip
                  key={r}
                  label={`${r} mi`}
                  active={draft.radiusMi === r}
                  onPress={() => setDraft({ ...draft, radiusMi: r })}
                />
              ))}
            </View>

            <Text style={styles.label}>Condition</Text>
            <View style={styles.row}>
              {ALL_CONDITIONS.map((c) => (
                <Chip
                  key={c}
                  label={c.replace("_", " ")}
                  active={draft.conditions.includes(c)}
                  onPress={() => toggleCondition(c)}
                />
              ))}
            </View>

            <Text style={styles.label}>Price range ($)</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={draft.minPrice}
                onChangeText={(v) => setDraft({ ...draft, minPrice: v })}
                placeholder="Min"
                keyboardType="decimal-pad"
                placeholderTextColor={Colors.faint}
              />
              <Text style={styles.dash}>—</Text>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={draft.maxPrice}
                onChangeText={(v) => setDraft({ ...draft, maxPrice: v })}
                placeholder="Max"
                keyboardType="decimal-pad"
                placeholderTextColor={Colors.faint}
              />
            </View>

            {showWeight && (
              <>
                <Text style={styles.label}>Weight (lbs)</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={draft.minLbs}
                    onChangeText={(v) => setDraft({ ...draft, minLbs: v })}
                    placeholder="Min"
                    keyboardType="decimal-pad"
                    placeholderTextColor={Colors.faint}
                  />
                  <Text style={styles.dash}>—</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={draft.maxLbs}
                    onChangeText={(v) => setDraft({ ...draft, maxLbs: v })}
                    placeholder="Max"
                    keyboardType="decimal-pad"
                    placeholderTextColor={Colors.faint}
                  />
                </View>
                <Text style={styles.hint}>
                  Scrap and parts buyers usually filter by weight — set a floor to skip small lots.
                </Text>
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.apply} onPress={() => onApply(draft)}>
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Returns true if any non-default filter is set. */
export function hasActiveFilters(f: FeedFilters): boolean {
  return (
    f.conditions.length > 0 ||
    !!f.minPrice ||
    !!f.maxPrice ||
    !!f.minLbs ||
    !!f.maxLbs ||
    f.radiusMi !== DEFAULT_FILTERS.radiusMi ||
    f.sortBy !== DEFAULT_FILTERS.sortBy
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  handle: {
    alignSelf: "center", width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, marginBottom: Spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...Type.heading, color: Colors.text },
  reset: { color: Colors.primary, fontWeight: "600" },
  label: { ...Type.small, color: Colors.muted, marginTop: Spacing.md, marginBottom: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1,
    borderRadius: Radii.pill,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.text, fontSize: 13, fontWeight: "500" },
  input: {
    backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1,
    borderRadius: Radii.md, padding: Spacing.sm, color: Colors.text,
  },
  dash: { color: Colors.muted, paddingHorizontal: 4 },
  hint: { ...Type.caption, color: Colors.muted, marginTop: 6, fontStyle: "italic" },
  footer: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  cancel: {
    flex: 1, backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1,
    padding: Spacing.md, borderRadius: Radii.md, alignItems: "center",
  },
  cancelText: { color: Colors.text, fontWeight: "600" },
  apply: {
    flex: 2, backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radii.md, alignItems: "center",
  },
  applyText: { color: "#fff", fontWeight: "700" },
});
