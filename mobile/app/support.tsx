import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import {
  fetchSupportEntries,
  postContactForm,
  type SupportEntry,
} from "@garzoni/core";
import GlassButton from "../src/components/ui/GlassButton";
import { Skeleton } from "../src/components/ui";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

export default function SupportScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const [openId, setOpenId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  const q = useQuery({
    queryKey: ["supportEntries"],
    queryFn: () => fetchSupportEntries().then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: postContactForm,
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: "success",
        text1: t("support.mobile.toastSuccessTitle"),
        text2: t("support.mobile.toastSuccessBody"),
      });
      setEmail("");
      setTopic("");
      setMessage("");
    },
    onError: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: "error",
        text1: t("support.mobile.toastErrorTitle"),
        text2: t("support.mobile.toastErrorBody"),
      });
    },
  });

  const entries = q.data ?? [];

  const onSubmit = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutation.mutate({
      email: email.trim(),
      topic: topic.trim(),
      message: message.trim(),
    });
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
            <Text style={[styles.a, { color: c.textMuted }]}>
              {item.answer}
            </Text>
          ) : null}
        </Pressable>
      );
    },
    [c, openId],
  );

  const listHeader = useMemo(
    () => (
      <View style={{ marginBottom: spacing.xl }}>
        <Text style={[styles.h2, { color: c.accent }]}>
          {t("support.mobile.contactHeading")}
        </Text>
        <TextInput
          placeholder={t("support.mobile.placeholders.email")}
          placeholderTextColor={c.textFaint}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[
            styles.input,
            {
              borderColor: c.border,
              color: c.text,
              backgroundColor: c.inputBg,
            },
          ]}
        />
        <TextInput
          placeholder={t("support.mobile.placeholders.topic")}
          placeholderTextColor={c.textFaint}
          value={topic}
          onChangeText={setTopic}
          style={[
            styles.input,
            {
              borderColor: c.border,
              color: c.text,
              backgroundColor: c.inputBg,
            },
          ]}
        />
        <TextInput
          placeholder={t("support.mobile.placeholders.message")}
          placeholderTextColor={c.textFaint}
          value={message}
          onChangeText={setMessage}
          multiline
          style={[
            styles.input,
            styles.area,
            {
              borderColor: c.border,
              color: c.text,
              backgroundColor: c.inputBg,
            },
          ]}
        />
        <GlassButton
          variant="active"
          size="md"
          onPress={onSubmit}
          loading={mutation.isPending}
          disabled={!email.trim() || !message.trim()}
        >
          {t("support.mobile.send")}
        </GlassButton>
        <Text style={[styles.h2, { color: c.accent, marginTop: spacing.xxl }]}>
          {t("support.mobile.faqHeading")}
        </Text>
        {q.isPending && !q.data ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Skeleton width="100%" height={72} borderRadius={radius.md} />
            <Skeleton width="100%" height={72} borderRadius={radius.md} />
            <Skeleton width="100%" height={72} borderRadius={radius.md} />
          </View>
        ) : null}
      </View>
    ),
    [c, email, topic, message, mutation.isPending, onSubmit, q.isPending, q.data, t],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: t("support.mobile.screenTitle"),
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <FlatList
        data={q.isPending && !q.data ? [] : entries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEntry}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          q.isPending && !q.data ? null : entries.length === 0 && !q.isPending ? (
            <Text style={{ color: c.textMuted, fontSize: typography.sm }}>
              {t("support.empty")}
            </Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !!q.data}
            onRefresh={() => void q.refetch()}
            tintColor={c.primary}
          />
        }
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 48,
          backgroundColor: c.bg,
        }}
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
