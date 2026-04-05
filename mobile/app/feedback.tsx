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
import { router, Stack } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { submitFeedback, type FeedbackPayload } from "@monevo/core";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

const FEEDBACK_TYPES = [
  { key: "general", label: "General" },
  { key: "bug", label: "Bug Report" },
  { key: "feature", label: "Feature Request" },
  { key: "content", label: "Content" },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]["key"];

export default function FeedbackScreen() {
  const c = useThemeColors();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: FeedbackPayload) => submitFeedback(payload),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: "success",
        text1: "Feedback sent!",
        text2: "Thanks for helping us improve Monevo.",
      });
      router.back();
    },
    onError: (err: unknown) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Something went wrong. Please try again.";
      Toast.show({ type: "error", text1: "Failed to send", text2: msg });
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
          title: "Send Feedback",
          headerShown: true,
          headerTintColor: c.primary,
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
          <Text style={[styles.label, { color: c.text }]}>Type</Text>
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
                    borderColor:
                      feedbackType === ft.key ? c.primary : c.border,
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
                  {ft.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Message */}
          <Text style={[styles.label, { color: c.text }]}>Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what's on your mind… (min 10 characters)"
            placeholderTextColor={c.textFaint}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
            style={[
              styles.textarea,
              { color: c.text, borderColor: c.border, backgroundColor: c.surface },
            ]}
          />
          <Text style={[styles.charCount, { color: c.textFaint }]}>
            {message.length} / 2000
          </Text>

          {/* Email (optional) */}
          <Text style={[styles.label, { color: c.text }]}>
            Email{" "}
            <Text style={{ color: c.textMuted, fontWeight: "400" }}>
              (optional — for follow-up)
            </Text>
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={c.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: c.text, borderColor: c.border, backgroundColor: c.surface },
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
                Send Feedback
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
