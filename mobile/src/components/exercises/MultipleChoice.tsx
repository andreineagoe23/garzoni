import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NotificationFeedbackType } from "expo-haptics";
import { useTranslation } from "react-i18next";
import { submitExerciseAnswer } from "@garzoni/core";
import { safeNotificationAsync } from "../../utils/safeHaptics";
import { Card, Button } from "../ui";
import { spacing, typography, radius } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";
import type {
  ExerciseGradingMode,
  StandaloneSubmitResult,
} from "../lesson/ExerciseSection";

type Props = {
  data: Record<string, unknown>;
  exerciseId?: string | number;
  sectionId?: string | number;
  isCompleted?: boolean;
  disabled?: boolean;
  onAttempt?: (payload: { correct: boolean }) => void;
  onComplete?: () => Promise<void> | void;
  gradingMode?: ExerciseGradingMode;
  hintsUsed?: number;
  onStandaloneSubmitResult?: (r: StandaloneSubmitResult) => void;
  skill?: string | null;
};

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    question: {
      fontSize: typography.md,
      fontWeight: "600",
      color: c.text,
      marginBottom: spacing.lg,
      lineHeight: 24,
    },
    options: { gap: spacing.sm },
    option: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: c.surface,
    },
    optionSelected: {
      borderColor: c.accent,
      backgroundColor: c.surfaceElevated,
    },
    optionCorrect: {
      borderColor: c.success,
      backgroundColor: c.successBg,
    },
    optionWrong: {
      borderColor: c.error,
      backgroundColor: c.errorBg,
    },
    optionText: { fontSize: typography.base, color: c.text },
    optionTextSelected: { fontWeight: "600" },
    feedback: {
      fontSize: typography.sm,
      fontWeight: "600",
      marginTop: spacing.md,
    },
    feedbackSuccess: { color: c.success },
    feedbackError: { color: c.error },
    explanation: {
      fontSize: typography.sm,
      color: c.textMuted,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
  });
}

export default function MultipleChoice({
  data,
  exerciseId,
  sectionId,
  isCompleted: isCompletedProp,
  disabled,
  onAttempt,
  onComplete,
  gradingMode = "lesson",
  hintsUsed = 0,
  onStandaloneSubmitResult,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const styles = useMemo(() => createStyles(c), [c]);

  const question = data?.question as string | undefined;
  const options = (data?.options ?? []) as string[];
  const correctAnswer = data?.correctAnswer as number | undefined;
  const explanation = data?.explanation as string | undefined;

  // Stable shuffle per exercise. `selected` always holds the original index.
  const shuffled = useMemo(() => {
    if (options.length === 0) return { options, originalOf: (i: number) => i };
    const order = options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return {
      options: order.map((i) => options[i]),
      originalOf: (shuffledIdx: number) => order[shuffledIdx],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, sectionId]);

  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null,
  );
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelected(null);
    setFeedback("");
    setFeedbackType(null);
    setIsCompleted(Boolean(isCompletedProp));
    setSubmitting(false);
  }, [exerciseId, sectionId, isCompletedProp, data]);

  const handleSubmit = async () => {
    if (disabled || selected === null || submitting) return;

    if (gradingMode === "standalone" && exerciseId != null) {
      setSubmitting(true);
      try {
        const { data: res } = await submitExerciseAnswer(exerciseId, {
          user_answer: selected,
          hints_used: hintsUsed,
          ...(sectionId != null ? { section_id: sectionId } : {}),
        });
        const fb =
          (typeof res.feedback === "string" && res.feedback) ||
          (typeof res.explanation === "string" && res.explanation) ||
          (res.correct
            ? t("exercises.widgets.correctShort")
            : t("exercises.widgets.tryAgainAdjust"));
        onStandaloneSubmitResult?.({
          correct: res.correct,
          feedback: fb,
          xpDelta: res.xp_delta,
        });
        onAttempt?.({ correct: res.correct });
        if (res.correct) {
          void safeNotificationAsync(NotificationFeedbackType.Success);
          setFeedback("");
          setFeedbackType("success");
          setIsCompleted(true);
          try {
            await onComplete?.();
          } catch {
            onStandaloneSubmitResult?.({
              correct: false,
              feedback: t("exercises.widgets.couldNotSave"),
            });
            setIsCompleted(false);
          }
        } else {
          void safeNotificationAsync(NotificationFeedbackType.Error);
          setFeedback("");
          setFeedbackType("error");
          // Real AI intervention (explain endpoint + rescue sheet) on the
          // 2nd consecutive wrong attempt now lives in the flow screen's
          // handleAttempt, driven by the `onAttempt` callback above — this
          // widget only reports correctness, it does not navigate or fetch.
        }
      } catch {
        const msg = t("exercises.errors.submissionFailed");
        onStandaloneSubmitResult?.({ correct: false, feedback: msg });
        onAttempt?.({ correct: false });
        setFeedback("");
        setFeedbackType("error");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const correct = selected === correctAnswer;
    onAttempt?.({ correct });

    if (correct) {
      void safeNotificationAsync(NotificationFeedbackType.Success);
      setFeedback(t("exercises.widgets.correctShort"));
      setFeedbackType("success");
      setIsCompleted(true);
      try {
        await onComplete?.();
      } catch {
        setFeedback(t("exercises.widgets.couldNotSave"));
        setFeedbackType("error");
        setIsCompleted(false);
      }
    } else {
      void safeNotificationAsync(NotificationFeedbackType.Error);
      setFeedback(t("exercises.widgets.notQuiteTryAgain"));
      setFeedbackType("error");
    }
  };

  return (
    <Card>
      {question ? <Text style={styles.question}>{question}</Text> : null}
      {gradingMode === "lesson" ? (
        <Text style={[styles.explanation, { marginBottom: spacing.sm }]}>
          {t("exercises.widgets.chooseBest")}
        </Text>
      ) : null}
      <View style={styles.options}>
        {shuffled.options.map((opt, i) => {
          const origIdx = shuffled.originalOf(i);
          const isSelected = selected === origIdx;
          const showResult = feedbackType != null && isSelected;
          return (
            <Pressable
              key={i}
              disabled={isCompleted || disabled}
              onPress={() => {
                setSelected(origIdx);
                setFeedback("");
                setFeedbackType(null);
              }}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                showResult &&
                  (feedbackType === "success"
                    ? styles.optionCorrect
                    : styles.optionWrong),
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                ]}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {gradingMode === "lesson" && feedback ? (
        <Text
          style={[
            styles.feedback,
            feedbackType === "success"
              ? styles.feedbackSuccess
              : styles.feedbackError,
          ]}
        >
          {feedback}
        </Text>
      ) : null}

      {explanation && isCompleted ? (
        <Text style={styles.explanation}>{explanation}</Text>
      ) : null}

      {!isCompleted && selected !== null ? (
        <Button
          size="sm"
          onPress={() => void handleSubmit()}
          style={{ marginTop: spacing.md }}
          loading={submitting}
        >
          {gradingMode === "standalone"
            ? t("exercises.widgets.checkAnswer")
            : t("exercises.widgets.submit")}
        </Button>
      ) : null}
    </Card>
  );
}
