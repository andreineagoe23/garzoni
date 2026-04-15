import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { submitExerciseAnswer } from "@garzoni/core";
import { Card, Button, Badge } from "../ui";
import { spacing, typography, radius } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";
import type {
  ExerciseGradingMode,
  StandaloneSubmitResult,
} from "../lesson/ExerciseSection";

type Item = { id: string | number; label?: string };
type Target = { id: string | number; label?: string };

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
};

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    question: {
      fontSize: typography.md,
      fontWeight: "600",
      color: c.text,
      lineHeight: 24,
      marginBottom: spacing.lg,
    },
    placed: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
      alignItems: "center",
    },
    undo: { color: c.error, fontSize: typography.sm, fontWeight: "600" },
    pool: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: c.surfaceOffset,
    },
    chipText: { fontSize: typography.base, color: c.text },
    feedback: {
      fontSize: typography.sm,
      fontWeight: "600",
      marginTop: spacing.md,
    },
    fOk: { color: c.success },
    fErr: { color: c.error },
    explanation: {
      fontSize: typography.sm,
      color: c.textMuted,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
  });
}

export default function DragAndDrop({
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

  const items = (data?.items ?? []) as Item[];
  const targets = (data?.targets ?? []) as Target[];
  const explanation = data?.explanation as string | undefined;

  const [order, setOrder] = useState<(string | number)[]>([]);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(
    null,
  );
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setOrder([]);
    setFeedback("");
    setFeedbackType(null);
    setIsCompleted(Boolean(isCompletedProp));
    setSubmitting(false);
  }, [exerciseId, sectionId, isCompletedProp, data]);

  const available = useMemo(
    () => items.filter((it) => !order.includes(it.id)),
    [items, order],
  );

  const correctOrder = useMemo(() => {
    if (targets.length > 0) return targets.map((t) => t.id);
    return items.map((it) => it.id);
  }, [targets, items]);

  const handleTap = (id: string | number) => {
    if (isCompleted || disabled) return;
    setOrder((prev) => [...prev, id]);
    setFeedback("");
    setFeedbackType(null);
  };

  const handleUndo = () => {
    setOrder((prev) => prev.slice(0, -1));
    setFeedback("");
    setFeedbackType(null);
  };

  const orderToIndices = (): number[] =>
    order.map((id) => items.findIndex((it) => it.id === id));

  const handleSubmit = async () => {
    if (disabled || submitting) return;
    if (order.length !== items.length) return;

    if (gradingMode === "standalone" && exerciseId != null) {
      const userAnswer = orderToIndices();
      if (userAnswer.some((ix) => ix < 0)) return;
      setSubmitting(true);
      try {
        const { data: res } = await submitExerciseAnswer(exerciseId, {
          user_answer: userAnswer,
          hints_used: hintsUsed,
          ...(sectionId != null ? { section_id: sectionId } : {}),
        });
        const fb =
          (typeof res.feedback === "string" && res.feedback) ||
          (typeof res.explanation === "string" && res.explanation) ||
          (res.correct
            ? t("exercises.widgets.greatOrder")
            : t("exercises.widgets.wrongOrder"));
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

    const allCorrect =
      order.length === correctOrder.length &&
      order.every((id, i) => id === correctOrder[i]);

    onAttempt?.({ correct: allCorrect });

    if (allCorrect) {
      setFeedback(t("exercises.widgets.greatOrder"));
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
      setFeedback(t("exercises.widgets.wrongOrder"));
      setFeedbackType("error");
      setOrder([]);
    }
  };

  const itemLabel = (id: string | number) =>
    items.find((it) => it.id === id)?.label ?? String(id);

  return (
    <Card>
      <Text style={styles.question}>
        {(data?.question as string) ?? t("exercises.widgets.dragPrompt")}
      </Text>

      {order.length > 0 ? (
        <View style={styles.placed}>
          {order.map((id, i) => (
            <Badge
              key={`${id}-${i}`}
              label={`${i + 1}. ${itemLabel(id)}`}
              color={c.accent}
            />
          ))}
          {!isCompleted ? (
            <Pressable onPress={handleUndo}>
              <Text style={styles.undo}>{t("exercises.widgets.undo")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!isCompleted ? (
        <View style={styles.pool}>
          {available.map((it) => (
            <Pressable
              key={it.id}
              style={styles.chip}
              onPress={() => handleTap(it.id)}
              disabled={disabled}
            >
              <Text style={styles.chipText}>{it.label ?? String(it.id)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {gradingMode === "lesson" && feedback ? (
        <Text
          style={[
            styles.feedback,
            feedbackType === "success" ? styles.fOk : styles.fErr,
          ]}
        >
          {feedback}
        </Text>
      ) : null}

      {explanation && isCompleted ? (
        <Text style={styles.explanation}>{explanation}</Text>
      ) : null}

      {!isCompleted && order.length === items.length && items.length > 0 ? (
        <Button
          size="sm"
          onPress={() => void handleSubmit()}
          style={{ marginTop: spacing.md }}
          loading={submitting}
        >
          {t("exercises.widgets.checkOrder")}
        </Button>
      ) : null}
    </Card>
  );
}
