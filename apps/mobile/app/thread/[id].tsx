import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/store";
import { Colors, Radii, Spacing, Type } from "@/lib/theme";

interface Msg {
  id: string;
  sender_id: string;
  body_clean: string;
  flagged: boolean;
  created_at: string;
}

export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, body_clean, flagged, created_at")
      .eq("thread_id", id)
      .order("created_at");
    setMsgs((data ?? []) as Msg[]);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`thread:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${id}` },
        (payload) => {
          setMsgs((prev) => [...prev, payload.new as Msg]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        },
      )
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [id]);

  async function send() {
    if (!text.trim() || !session) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("redact-message", {
      body: { thread_id: id, body: text.trim() },
    });
    setBusy(false);
    if (error) return Alert.alert("Couldn't send", error.message);
    setText("");
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Phone numbers, addresses, and outside links are hidden until pickup is confirmed.
        </Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={88}
      >
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: Spacing.lg }}
          renderItem={({ item }) => {
            const mine = item.sender_id === session?.user.id;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{item.body_clean}</Text>
                {item.flagged && (
                  <Text style={styles.flag}>Contact info hidden</Text>
                )}
              </View>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message…"
            placeholderTextColor={Colors.faint}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (busy || !text.trim()) && { opacity: 0.5 }]}
            disabled={busy || !text.trim()}
            onPress={send}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, paddingHorizontal: Spacing.lg },
  bannerText: { ...Type.caption, color: Colors.muted, textAlign: "center" },
  bubble: {
    maxWidth: "78%",
    padding: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
  },
  mine: { backgroundColor: Colors.primary, alignSelf: "flex-end" },
  theirs: { backgroundColor: Colors.surface, alignSelf: "flex-start", borderColor: Colors.border, borderWidth: 1 },
  bubbleText: { color: Colors.text, fontSize: 15, lineHeight: 20 },
  flag: { ...Type.caption, color: Colors.warning, marginTop: 4 },
  composer: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    color: Colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    justifyContent: "center",
  },
});
