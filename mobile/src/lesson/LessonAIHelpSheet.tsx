import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  explainExercise,
  requestAiTutorHint,
  type ExplainResult,
} from "@garzoni/core";
import { Button, LoadingSpinner } from "../components/ui";
import { useThemeColors } from "../theme/ThemeContext";
import type { ThemeColors } from "../theme/palettes";
import { spacing, typography, radius } from "../theme/tokens";

/** Context for the exercise the learner is stuck on, resolved by the flow screen. */
export type LessonAIHelpContext = {
  question: string | null;
  exerciseType?: string;
  correctAnswer?: unknown;
  skill?: string | null;
  exerciseId?: number | string | null;
};

type Props = {
  visible: boolean;
  context: LessonAIHelpContext | null;
  /** Fires when the learner dismisses the sheet — the caller resumes the deferred heart decrement here. */
  onDismiss: () => void;
};

type ResultMode = "explain" | "hint" | "generic";

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "center",
      padding: spacing.xl,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      maxHeight: "88%",
    },
    closeBtn: {
      position: "absolute",
      right: spacing.sm,
      top: spacing.sm,
      zIndex: 2,
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    closeBtnText: {
      fontSize: 26,
      fontWeight: "300",
      color: c.textMuted,
      lineHeight: 28,
    },
    title: {
      fontSize: typography.xl,
      fontWeight: "800",
      color: c.text,
      textAlign: "center",
      marginTop: spacing.sm,
    },
    subtitle: {
      fontSize: typography.sm,
      color: c.textMuted,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    bodyText: {
      fontSize: typography.sm,
      color: c.text,
      lineHeight: 20,
    },
    explainBox: {
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: c.accent + "40",
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: c.accent + "12",
    },
    explainLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.accent,
      marginBottom: spacing.xs,
    },
    practiceBox: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: c.surfaceElevated,
    },
    practiceQuestion: {
      fontSize: typography.sm,
      color: c.text,
      fontWeight: "600",
    },
    practiceChoice: {
      fontSize: typography.sm,
      color: c.textMuted,
      marginTop: 2,
    },
    actions: { marginTop: spacing.xl },
  });
}

/**
 * In-context "rescue" sheet shown on the 2nd consecutive wrong answer for an
 * exercise. Tries a real AI explanation first; on quota exhaustion (or any
 * failure) it falls back to the static progressive-hint endpoint, and finally
 * to a generic client-side hint. Never shows an upsell/paywall — this is a
 * mid-lesson helper, not a monetization moment.
 */
export default function LessonAIHelpSheet({
  visible,
  context,
  onDismiss,
}: Props) {
  const { t } = useTranslation("common");
  const theme = useThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ResultMode | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(
    null,
  );
  const [hintText, setHintText] = useState<string | null>(null);
  const fetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      fetchedKeyRef.current = null;
      return;
    }
    if (!context?.question) {
      setLoading(false);
      setMode("generic");
      return;
    }

    const key = `${context.exerciseId ?? ""}:${context.question}`;
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;

    let cancelled = false;
    setLoading(true);
    setMode(null);
    setExplainResult(null);
    setHintText(null);

    const fallbackToHint = async () => {
      if (context.exerciseId != null) {
        try {
          const hint = await requestAiTutorHint(context.exerciseId, 2);
          if (hint && !cancelled) {
            setHintText(hint);
            setMode("hint");
            return;
          }
        } catch {
          // fall through to generic
        }
      }
      if (!cancelled) setMode("generic");
    };

    void (async () => {
      try {
        const result = await explainExercise({
          exerciseQuestion: context.question as string,
          exerciseType: context.exerciseType,
          correctAnswer: context.correctAnswer,
          userAnswer: "",
          skill: context.skill,
          exerciseId: context.exerciseId,
        });
        if (cancelled) return;
        if (result?.explanation) {
          setExplainResult(result);
          setMode("explain");
        } else {
          await fallbackToHint();
        }
      } catch (err) {
        // Quota exhaustion (ExerciseExplainQuotaError) and generic failures
        // both degrade to the static hint tiers — no upsell mid-lesson.
        void err;
        if (!cancelled) await fallbackToHint();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, context]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { position: "relative" }]}>
          <Pressable
            onPress={onDismiss}
            style={styles.closeBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("courses.flow.aiHelpDismissAria")}
          >
            <Text style={styles.closeBtnText}>×</Text>
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{t("courses.flow.aiHelpTitle")}</Text>
            <Text style={styles.subtitle}>
              {t("courses.flow.aiHelpSubtitle")}
            </Text>

            {loading ? (
              <View style={styles.loadingRow}>
                <LoadingSpinner size="sm" color={theme.accent} />
                <Text style={styles.bodyText}>
                  {t(
                    "exercises.explanation.loading",
                    "Garzoni is explaining...",
                  )}
                </Text>
              </View>
            ) : null}

            {!loading && mode === "explain" && explainResult ? (
              <View style={styles.explainBox}>
                <Text style={styles.explainLabel}>
                  {t("exercises.explanation.title", "Garzoni explains")}
                </Text>
                <Text style={styles.bodyText}>{explainResult.explanation}</Text>
                {explainResult.practice_question ? (
                  <View style={styles.practiceBox}>
                    <Text style={styles.explainLabel}>
                      {t(
                        "exercises.explanation.tryThis",
                        "Try a similar question",
                      )}
                    </Text>
                    <Text style={styles.practiceQuestion}>
                      {explainResult.practice_question.question}
                    </Text>
                    {Array.isArray(explainResult.practice_question.choices)
                      ? explainResult.practice_question.choices.map(
                          (choice: string, i: number) => (
                            <Text key={i} style={styles.practiceChoice}>
                              {String.fromCharCode(65 + i)}. {choice}
                            </Text>
                          ),
                        )
                      : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {!loading && mode === "hint" && hintText ? (
              <View style={styles.explainBox}>
                <Text style={styles.explainLabel}>
                  {t("courses.flow.aiHelpHintLabel")}
                </Text>
                <Text style={styles.bodyText}>{hintText}</Text>
              </View>
            ) : null}

            {!loading && mode === "generic" ? (
              <View style={styles.explainBox}>
                <Text style={styles.explainLabel}>
                  {t("courses.flow.aiHelpHintLabel")}
                </Text>
                <Text style={styles.bodyText}>
                  {t("courses.flow.aiHelpGenericHint")}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button onPress={onDismiss}>
                {t("courses.flow.aiHelpContinue")}
              </Button>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
