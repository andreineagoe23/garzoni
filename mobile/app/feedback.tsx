import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { submitFeedback, type FeedbackPayload } from "@garzoni/core";
import { safeRouterBack } from "../src/navigation/safeRouterBack";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

const FEEDBACK_TYPES = [
  { key: "general", labelKey: "feedback.types.general" },
  { key: "bug", labelKey: "feedback.types.bug" },
  { key: "feature", labelKey: "feedback.types.feature" },
  { key: "content", labelKey: "feedback.types.content" },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]["key"];

export default function FeedbackScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: FeedbackPayload) => submitFeedback(payload),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: "success",
        text1: t("feedback.toastSuccessTitle"),
        text2: t("feedback.toastSuccessBody"),
      });
      safeRouterBack("/(tabs)");
    },
    onError: (err: unknown) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || t("feedback.toastErrorBody");
      Toast.show({
        type: "error",
        text1: t("feedback.toastErrorTitle"),
        text2: msg,
      });
    },
  });

  const canSubmit = message.trim().length >= 10 && !mutation.isPending;

  const onSubmit = () => {
    if (!canSubmit) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutation.mutate({
      message: message.trim(),
      feedback_type: feedbackType,
      email: email.trim() || undefined,
      context_url: "mobile",
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("feedback.screenTitle"),
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type picker */}
          <Text style={[styles.label, { color: c.text }]}>
            {t("feedback.typeLabel")}
          </Text>
          <View style={styles.pills}>
            {FEEDBACK_TYPES.map((ft) => (
              <Pressable
                key={ft.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setFeedbackType(ft.key);
                }}
                style={[
                  styles.pill,
                  {
                    borderColor: feedbackType === ft.key ? c.primary : c.border,
                    backgroundColor:
                      feedbackType === ft.key
                        ? `${c.primary}18`
                        : c.surfaceOffset,
                  },
                ]}
              >
                <Text
                  style={{
                    color: feedbackType === ft.key ? c.primary : c.textMuted,
                    fontWeight: feedbackType === ft.key ? "700" : "500",
                    fontSize: typography.sm,
                  }}
                >
                  {t(ft.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Message */}
          <Text style={[styles.label, { color: c.text }]}>
            {t("feedback.messageLabel")}
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t("feedback.messagePlaceholder")}
            placeholderTextColor={c.textFaint}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
            style={[
              styles.textarea,
              {
                color: c.text,
                borderColor: c.border,
                backgroundColor: c.surface,
              },
            ]}
          />
          <Text style={[styles.charCount, { color: c.textFaint }]}>
            {message.length} / 2000
          </Text>

          {/* Email (optional) */}
          <Text style={[styles.label, { color: c.text }]}>
            {t("auth.register.email")}{" "}
            <Text style={{ color: c.textMuted, fontWeight: "400" }}>
              ({t("auth.register.optional")})
            </Text>
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.register.emailPlaceholder")}
            placeholderTextColor={c.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: c.text,
                borderColor: c.border,
                backgroundColor: c.surface,
              },
            ]}
          />

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              {
                backgroundColor: c.primary,
                opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <Text style={[styles.submitText, { color: c.textOnPrimary }]}>
                {t("feedback.send")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: "700",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.base,
    minHeight: 140,
    lineHeight: 22,
  },
  charCount: {
    fontSize: typography.xs,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.base,
  },
  submitBtn: {
    marginTop: spacing.xl,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  submitText: {
    fontSize: typography.base,
    fontWeight: "700",
  },
});
