import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchSupportEntries,
  postContactForm,
  type SupportEntry,
} from "@garzoni/core";
import GlassButton from "../src/components/ui/GlassButton";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import { Pressable } from "react-native";

export default function SupportScreen() {
  const c = useThemeColors();
  const [openId, setOpenId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [formMsg, setFormMsg] = useState("");

  const q = useQuery({
    queryKey: ["supportEntries"],
    queryFn: () => fetchSupportEntries().then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: postContactForm,
    onSuccess: (res) => {
      setFormMsg(
        (res as { data?: { message?: string } }).data?.message ??
          "Thanks — we received your message."
      );
      setEmail("");
      setTopic("");
      setMessage("");
    },
    onError: () => setFormMsg("Could not send. Try again later."),
  });

  const entries = q.data ?? [];

  const onSubmit = useCallback(() => {
    setFormMsg("");
    mutation.mutate({ email: email.trim(), topic: topic.trim(), message: message.trim() });
  }, [email, topic, message, mutation]);

  const renderEntry = useCallback(
    ({ item }: { item: SupportEntry }) => {
      const expanded = openId === item.id;
      return (
        <Pressable
          onPress={() => setOpenId(expanded ? null : item.id)}
          style={[
            styles.card,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.q, { color: c.text }]}>{item.question}</Text>
          {expanded ? (
            <Text style={[styles.a, { color: c.textMuted }]}>{item.answer}</Text>
          ) : null}
        </Pressable>
      );
    },
    [c, openId]
  );

  const listHeader = useMemo(
    () => (
      <View style={{ marginBottom: spacing.xl }}>
        <Text style={[styles.h2, { color: c.accent }]}>Contact</Text>
        <TextInput
          placeholder="Email"
          placeholderTextColor={c.textFaint}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.inputBg }]}
        />
        <TextInput
          placeholder="Topic"
          placeholderTextColor={c.textFaint}
          value={topic}
          onChangeText={setTopic}
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.inputBg }]}
        />
        <TextInput
          placeholder="Message"
          placeholderTextColor={c.textFaint}
          value={message}
          onChangeText={setMessage}
          multiline
          style={[
            styles.input,
            styles.area,
            { borderColor: c.border, color: c.text, backgroundColor: c.inputBg },
          ]}
        />
        <GlassButton
          variant="active"
          size="md"
          onPress={onSubmit}
          loading={mutation.isPending}
          disabled={!email.trim() || !message.trim()}
        >
          Send
        </GlassButton>
        {formMsg ? (
          <Text style={{ color: c.textMuted, marginTop: spacing.sm }}>{formMsg}</Text>
        ) : null}
        <Text style={[styles.h2, { color: c.accent, marginTop: spacing.xxl }]}>FAQ</Text>
      </View>
    ),
    [c, email, topic, message, formMsg, mutation.isPending, onSubmit]
  );

  return (
    <>
      <Stack.Screen options={{ title: "Support", headerShown: true, headerTintColor: c.primary }} />
      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEntry}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} tintColor={c.primary} />
        }
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, backgroundColor: c.bg }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: typography.md, fontWeight: "800", marginBottom: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontSize: typography.base,
  },
  area: { minHeight: 100, textAlignVertical: "top" },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  q: { fontSize: typography.base, fontWeight: "700" },
  a: { marginTop: spacing.sm, fontSize: typography.sm, lineHeight: 20 },
});
