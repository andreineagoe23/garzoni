import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { submitAppReview } from "@garzoni/core";
import type { AppReviewPayload } from "@garzoni/core";
import GlassButton from "../ui/GlassButton";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";
import {
  triggerHappyPathStoreReview,
  markReviewed,
} from "../../bootstrap/reviewPrompt";
import { trackGarzoniEvent } from "../../bootstrap/customerIoMobile";
import { useReviewPromptStore } from "./reviewPromptStore";

type Sentiment = "happy" | "neutral" | "unhappy";
type Step = "sentiment" | "reason" | "thanks";

const REASON_KEYS = [
  "too_hard",
  "too_easy",
  "too_few_lessons",
  "bugs",
  "price",
  "content",
  "other",
] as const;

const SENTIMENTS: { value: Sentiment; emoji: string; labelKey: string }[] = [
  { value: "unhappy", emoji: "😞", labelKey: "reviewPrompt.unhappy" },
  { value: "neutral", emoji: "😐", labelKey: "reviewPrompt.neutral" },
  { value: "happy", emoji: "😍", labelKey: "reviewPrompt.happy" },
];

function appVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}

/** Fire-and-forget; the prompt must never block on or be broken by reporting. */
function report(payload: AppReviewPayload): void {
  void submitAppReview(payload).catch(() => {});
  void trackGarzoniEvent("app_review_response", {
    sentiment: payload.sentiment,
    routed_to_store: payload.routed_to_store ?? false,
  });
}

export default function ReviewPromptModal() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const visible = useReviewPromptStore((s) => s.visible);
  const close = useReviewPromptStore((s) => s.close);

  const [step, setStep] = useState<Step>("sentiment");
  const [reasons, setReasons] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentiment, setSentiment] = useState<Sentiment>("neutral");

  function reset() {
    setStep("sentiment");
    setReasons([]);
    setMessage("");
    setSubmitting(false);
    setSentiment("neutral");
  }

  function dismiss() {
    close();
    // Defer reset so it doesn't flash the first step during the exit animation.
    setTimeout(reset, 250);
  }

  async function onPickSentiment(value: Sentiment) {
    void Haptics.selectionAsync();
    setSentiment(value);
    if (value === "happy") {
      report({
        sentiment: "happy",
        routed_to_store: true,
        platform: Platform.OS,
        app_version: appVersion(),
      });
      // They're going to the store — never prompt again.
      void markReviewed();
      // Close our prompt before handing off to the native store sheet / listing.
      dismiss();
      await triggerHappyPathStoreReview();
      return;
    }
    setStep("reason");
  }

  function toggleReason(key: string) {
    void Haptics.selectionAsync();
    setReasons((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    );
  }

  function onSubmitReason() {
    setSubmitting(true);
    report({
      sentiment,
      reasons,
      message: message.trim(),
      routed_to_store: false,
      platform: Platform.OS,
      app_version: appVersion(),
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep("thanks");
    setSubmitting(false);
    setTimeout(dismiss, 1600);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: "#000a" }]}
          onPress={dismiss}
        >
          <Pressable
            style={styles.sheetWrap}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View
              entering={SlideInDown.springify().damping(18)}
              exiting={SlideOutDown.duration(220)}
              style={[
                styles.sheet,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {step === "sentiment" && (
                <>
                  <Text style={[styles.title, { color: c.text }]}>
                    {t("reviewPrompt.sentimentTitle")}
                  </Text>
                  <Text style={[styles.body, { color: c.textMuted }]}>
                    {t("reviewPrompt.sentimentSubtitle")}
                  </Text>
                  <View style={styles.sentimentRow}>
                    {SENTIMENTS.map((s) => (
                      <Pressable
                        key={s.value}
                        onPress={() => onPickSentiment(s.value)}
                        style={[
                          styles.sentimentItem,
                          {
                            borderColor: c.border,
                            backgroundColor: c.surfaceOffset,
                          },
                        ]}
                      >
                        <Text style={styles.sentimentEmoji}>{s.emoji}</Text>
                        <Text
                          style={[
                            styles.sentimentLabel,
                            { color: c.textMuted },
                          ]}
                        >
                          {t(s.labelKey)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    onPress={dismiss}
                    style={{ marginTop: spacing.md }}
                  >
                    <Text style={[styles.dismiss, { color: c.textMuted }]}>
                      {t("reviewPrompt.skip")}
                    </Text>
                  </Pressable>
                </>
              )}

              {step === "reason" && (
                <>
                  <Text style={[styles.title, { color: c.text }]}>
                    {t("reviewPrompt.reasonTitle")}
                  </Text>
                  <Text style={[styles.body, { color: c.textMuted }]}>
                    {t("reviewPrompt.reasonSubtitle")}
                  </Text>
                  <View style={styles.chips}>
                    {REASON_KEYS.map((key) => {
                      const active = reasons.includes(key);
                      return (
                        <Pressable
                          key={key}
                          onPress={() => toggleReason(key)}
                          style={[
                            styles.chip,
                            {
                              borderColor: active ? c.primary : c.border,
                              backgroundColor: active
                                ? c.primary
                                : c.surfaceOffset,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: active ? c.textOnPrimary : c.text },
                            ]}
                          >
                            {t(`reviewPrompt.reasons.${key}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        borderColor: c.border,
                        backgroundColor: c.surfaceOffset,
                      },
                    ]}
                    placeholder={t("reviewPrompt.messagePlaceholder")}
                    placeholderTextColor={c.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={2000}
                  />
                  <GlassButton
                    variant="primary"
                    onPress={onSubmitReason}
                    style={{ marginTop: spacing.md }}
                    disabled={submitting}
                  >
                    {submitting
                      ? t("reviewPrompt.submitting")
                      : t("reviewPrompt.submit")}
                  </GlassButton>
                </>
              )}

              {step === "thanks" && (
                <>
                  <Text style={[styles.title, { color: c.text }]}>
                    {t("reviewPrompt.thanksTitle")}
                  </Text>
                  <Text style={[styles.body, { color: c.textMuted }]}>
                    {t("reviewPrompt.thanksBody")}
                  </Text>
                </>
              )}
            </Animated.View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheetWrap: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sheet: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  sentimentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sentimentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  sentimentEmoji: { fontSize: 34, marginBottom: spacing.xs },
  sentimentLabel: { fontSize: typography.xs, fontWeight: "600" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  chipText: { fontSize: typography.sm, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    fontSize: typography.sm,
    textAlignVertical: "top",
  },
  dismiss: {
    fontSize: typography.sm,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
