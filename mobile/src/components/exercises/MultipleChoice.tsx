import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NotificationFeedbackType } from "expo-haptics";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { submitExerciseAnswer, explainExercise } from "@garzoni/core";
import type { ExplainResult } from "@garzoni/core";
import { safeNotificationAsync } from "../../utils/safeHaptics";
import { Card, Button, LoadingSpinner } from "../ui";
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
    aiExplainBox: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: c.accent + "40",
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: c.accent + "12",
    },
    aiExplainLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.accent,
      marginBottom: spacing.xs,
    },
    aiExplainText: {
      fontSize: typography.sm,
      color: c.text,
      lineHeight: 20,
    },
    practiceBox: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: c.surfaceElevated,
    },
    practiceLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: c.textMuted,
      marginBottom: spacing.xs,
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
  skill,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const styles = useMemo(() => createStyles(c), [c]);

  const question = data?.question as string | undefined;
  const options = (data?.options ?? []) as string[];
  const correctAnswer = data?.correctAnswer as number | undefined;
  const explanation = data?.explanation as string | undefined;
  const dataSkill = (data?.skill as string | undefined) ?? skill ?? null;

  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null,
  );
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));
  const [submitting, setSubmitting] = useState(false);
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(
    null,
  );
  const [loadingExplain, setLoadingExplain] = useState(false);

  useEffect(() => {
    setSelected(null);
    setFeedback("");
    setFeedbackType(null);
    setIsCompleted(Boolean(isCompletedProp));
    setSubmitting(false);
    setExplainResult(null);
    setLoadingExplain(false);
  }, [exerciseId, sectionId, isCompletedProp, data]);

  const fetchExplanation = async (userAnswerText: string) => {
    if (!question) return;
    setLoadingExplain(true);
    try {
      const result = await explainExercise({
        exerciseQuestion: question,
        exerciseType: "multiple_choice",
        correctAnswer:
          correctAnswer != null ? options[correctAnswer] : undefined,
        userAnswer: userAnswerText,
        skill: dataSkill,
        exerciseId: exerciseId ?? null,
      });
      setExplainResult(result);
    } catch {
      // silent — static feedback still shown
    } finally {
      setLoadingExplain(false);
    }
  };

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
          // After 2+ wrong attempts offer AI help via the chat screen
          if ((res.attempts ?? 0) >= 2 && question) {
            const preseeded = encodeURIComponent(
              `I'm stuck on this exercise: "${question}". I answered option ${(selected ?? 0) + 1} but it was wrong. Can you give me a hint without revealing the answer?`,
            );
            setTimeout(
              () => router.push(`/chat?preseededMessage=${preseeded}`),
              800,
            );
          }
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
      if (question) {
        void fetchExplanation(options[selected] ?? String(selected));
      }
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
        {options.map((opt, i) => {
          const isSelected = selected === i;
          const showResult = feedbackType != null && isSelected;
          return (
            <Pressable
              key={i}
              disabled={isCompleted || disabled}
              onPress={() => {
                setSelected(i);
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

      {/* AI explanation block (wrong answer only) */}
      {feedbackType === "error" && loadingExplain && (
        <View
          style={[
            styles.aiExplainBox,
            { flexDirection: "row", alignItems: "center", gap: spacing.sm },
          ]}
        >
          <LoadingSpinner size="sm" color={c.accent} />
          <Text style={styles.aiExplainText}>
            {t("exercises.explanation.loading", "Garzoni is explaining...")}
          </Text>
        </View>
      )}
      {feedbackType === "error" && explainResult?.explanation ? (
        <View style={styles.aiExplainBox}>
          <Text style={styles.aiExplainLabel}>
            {t("exercises.explanation.title", "Garzoni explains")}
          </Text>
          <Text style={styles.aiExplainText}>{explainResult.explanation}</Text>
        </View>
      ) : null}
      {feedbackType === "error" && explainResult?.practice_question ? (
        <View style={styles.practiceBox}>
          <Text style={styles.practiceLabel}>
            {t("exercises.explanation.tryThis", "Try a similar question")}
          </Text>
          <Text style={styles.practiceQuestion}>
            {explainResult.practice_question.question}
          </Text>
          {Array.isArray(explainResult.practice_question.choices)
            ? explainResult.practice_question.choices.map(
                (c: string, i: number) => (
                  <Text key={i} style={styles.practiceChoice}>
                    {String.fromCharCode(65 + i)}. {c}
                  </Text>
                ),
              )
            : null}
        </View>
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
