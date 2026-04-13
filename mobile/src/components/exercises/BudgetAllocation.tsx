import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { submitExerciseAnswer } from "@garzoni/core";
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
  isCompleted?: boolean;
  disabled?: boolean;
  onAttempt?: (payload: { correct: boolean }) => void;
  onComplete?: () => Promise<void> | void;
  gradingMode?: ExerciseGradingMode;
  hintsUsed?: number;
  onStandaloneSubmitResult?: (r: StandaloneSubmitResult) => void;
};

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    question: {
      fontSize: typography.md,
      fontWeight: "600",
      color: c.text,
      marginBottom: spacing.md,
      lineHeight: 24,
    },
    totalLabel: {
      fontSize: typography.sm,
      color: c.textMuted,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    catLabel: {
      flex: 1,
      fontSize: typography.base,
      color: c.text,
    },
    input: {
      width: 80,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      padding: spacing.sm,
      textAlign: "center",
      fontSize: typography.base,
      color: c.text,
      backgroundColor: c.inputBg,
    },
    feedback: {
      fontSize: typography.sm,
      fontWeight: "600",
      marginTop: spacing.md,
    },
    fSuccess: { color: c.success },
    fError: { color: c.error },
  });
}

export default function BudgetAllocation({
  data,
  exerciseId,
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
  const categories = (data?.categories ?? []) as string[];
  const total = Number(data?.total ?? 0);

  const [allocations, setAllocations] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((cat) => [cat, ""])),
  );
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null,
  );
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAllocations(Object.fromEntries(categories.map((cat) => [cat, ""])));
    setFeedback("");
    setFeedbackType(null);
    setIsCompleted(Boolean(isCompletedProp));
    setSubmitting(false);
  }, [exerciseId, isCompletedProp, categories.join("|")]);

  const currentTotal = useMemo(
    () =>
      Object.values(allocations).reduce(
        (sum, v) => sum + (parseInt(v, 10) || 0),
        0,
      ),
    [allocations],
  );

  const handleSubmit = async () => {
    if (disabled || submitting) return;

    if (gradingMode === "standalone" && exerciseId != null) {
      const userAnswer = categories.reduce<Record<string, number>>(
        (acc, cat) => {
          acc[cat] = parseInt(allocations[cat] ?? "0", 10) || 0;
          return acc;
        },
        {},
      );
      setSubmitting(true);
      try {
        const { data: res } = await submitExerciseAnswer(exerciseId, {
          user_answer: userAnswer,
          hints_used: hintsUsed,
        });
        const fb =
          (typeof res.feedback === "string" && res.feedback) ||
          (typeof res.explanation === "string" && res.explanation) ||
          (res.correct
            ? t("exercises.widgets.greatAllocation")
            : t("exercises.widgets.tryAgainAdjust"));
        onStandaloneSubmitResult?.({
          correct: res.correct,
          feedback: fb,
          xpDelta: res.xp_delta,
        });
        onAttempt?.({ correct: res.correct });
        if (res.correct) {
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
          setFeedback("");
          setFeedbackType("error");
        }
      } catch {
        const msg = t("exercises.errors.submissionFailed");
        onStandaloneSubmitResult?.({ correct: false, feedback: msg });
        onAttempt?.({ correct: false });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const correct = currentTotal === total;
    onAttempt?.({ correct });

    if (correct) {
      setFeedback(t("exercises.widgets.greatAllocation"));
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
      setFeedback(
        t("exercises.widgets.budgetTotalHint", {
          total,
          current: currentTotal,
        }),
      );
      setFeedbackType("error");
    }
  };

  return (
    <Card>
      {question ? <Text style={styles.question}>{question}</Text> : null}
      <Text style={styles.totalLabel}>
        Budget: {currentTotal} / {total}
      </Text>
      {categories.map((cat) => (
        <View key={cat} style={styles.row}>
          <Text style={styles.catLabel}>{cat}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={allocations[cat]}
            editable={!isCompleted && !disabled}
            onChangeText={(v) =>
              setAllocations((prev) => ({
                ...prev,
                [cat]: v.replace(/[^0-9]/g, ""),
              }))
            }
            placeholder="0"
            placeholderTextColor={c.textFaint}
          />
        </View>
      ))}

      {gradingMode === "lesson" && feedback ? (
        <Text
          style={[
            styles.feedback,
            feedbackType === "success" ? styles.fSuccess : styles.fError,
          ]}
        >
          {feedback}
        </Text>
      ) : null}

      {!isCompleted ? (
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
