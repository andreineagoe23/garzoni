import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
      lineHeight: 24,
    },
    headerRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: c.border,
    },
    dataRow: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    labelCell: { width: 100, padding: spacing.sm, justifyContent: "center" },
    cell: { width: 100, padding: spacing.xs },
    headerText: {
      fontSize: typography.xs,
      fontWeight: "700",
      color: c.textMuted,
      textTransform: "uppercase",
    },
    rowLabel: { fontSize: typography.sm, fontWeight: "600", color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      padding: spacing.xs,
      fontSize: typography.sm,
      color: c.text,
      textAlign: "center",
      backgroundColor: c.inputBg,
    },
    feedback: { fontSize: typography.sm, fontWeight: "600" },
    fSuccess: { color: c.success },
    fError: { color: c.error },
  });
}

export default function FillInTable({
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
  const columns = (data?.columns ?? []) as string[];
  const rows = (data?.rows ?? []) as { id: string; label?: string }[];
  const correctAnswer = data?.correctAnswer as
    | Record<string, string[]>
    | undefined;

  const emptyAnswers = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, columns.map(() => "")])),
    [rows, columns],
  );

  const [answers, setAnswers] =
    useState<Record<string, string[]>>(emptyAnswers);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null,
  );
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));
  const [submitting, setSubmitting] = useState(false);

  const rowsKey = rows.map((r) => r.id).join("|");
  const colsKey = columns.join("|");

  useEffect(() => {
    setAnswers(
      Object.fromEntries(rows.map((r) => [r.id, columns.map(() => "")])),
    );
    setFeedback("");
    setFeedbackType(null);
    setIsCompleted(Boolean(isCompletedProp));
    setSubmitting(false);
  }, [exerciseId, isCompletedProp, rowsKey, colsKey]);

  const handleSubmit = async () => {
    if (disabled || submitting) return;

    if (gradingMode === "standalone" && exerciseId != null) {
      setSubmitting(true);
      try {
        const { data: res } = await submitExerciseAnswer(exerciseId, {
          user_answer: answers,
          hints_used: hintsUsed,
        });
        const fb =
          (typeof res.feedback === "string" && res.feedback) ||
          (typeof res.explanation === "string" && res.explanation) ||
          (res.correct
            ? t("exercises.widgets.correctShort")
            : t("exercises.widgets.cellsWrong"));
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

    const isCorrect =
      correctAnswer &&
      Object.entries(correctAnswer).every(([rowId, expected]) =>
        expected.every(
          (val, ci) =>
            String(val ?? "")
              .trim()
              .toLowerCase() ===
            String(answers[rowId]?.[ci] ?? "")
              .trim()
              .toLowerCase(),
        ),
      );

    onAttempt?.({ correct: Boolean(isCorrect) });

    if (isCorrect) {
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
      setFeedback(t("exercises.widgets.cellsWrong"));
      setFeedbackType("error");
    }
  };

  if (!columns.length || !rows.length) {
    return (
      <Card>
        <Text style={[styles.question, { color: c.textMuted }]}>
          {t("exercises.errors.invalidFormat")}
        </Text>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <View style={{ padding: spacing.lg }}>
        {question ? <Text style={styles.question}>{question}</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.labelCell} />
            {columns.map((col, ci) => (
              <View key={ci} style={styles.cell}>
                <Text style={styles.headerText}>{col}</Text>
              </View>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.id} style={styles.dataRow}>
              <View style={styles.labelCell}>
                <Text style={styles.rowLabel}>{row.label ?? row.id}</Text>
              </View>
              {columns.map((_, ci) => (
                <View key={ci} style={styles.cell}>
                  <TextInput
                    style={styles.input}
                    value={answers[row.id]?.[ci] ?? ""}
                    editable={!isCompleted && !disabled}
                    onChangeText={(v) =>
                      setAnswers((prev) => {
                        const rowVals = [...(prev[row.id] ?? [])];
                        rowVals[ci] = v;
                        return { ...prev, [row.id]: rowVals };
                      })
                    }
                    placeholderTextColor={c.textFaint}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ padding: spacing.lg }}>
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
            style={{ marginTop: spacing.sm }}
            loading={submitting}
          >
            {gradingMode === "standalone"
              ? t("exercises.widgets.checkAnswer")
              : t("exercises.widgets.submit")}
          </Button>
        ) : null}
      </View>
    </Card>
  );
}
