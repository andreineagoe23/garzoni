import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

type Choice = { id: string | number; label: string };

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
    scenario: {
      fontSize: typography.base,
      color: c.textMuted,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    question: {
      fontSize: typography.md,
      fontWeight: "600",
      color: c.text,
      lineHeight: 24,
      marginBottom: spacing.lg,
    },
    choices: { gap: spacing.sm },
    choice: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      backgroundColor: c.surface,
    },
    choiceSelected: {
      borderColor: c.accent,
      backgroundColor: c.surfaceElevated,
    },
    choiceText: { fontSize: typography.base, color: c.text },
    choiceTextSel: { fontWeight: "600" },
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

function normalizeChoices(raw: unknown[]): Choice[] {
  return raw.map((ch, i) => {
    if (ch && typeof ch === "object" && "id" in ch) {
      const o = ch as { id: unknown; label?: unknown; text?: unknown };
      const id = o.id ?? i;
      const label =
        typeof o.label === "string"
          ? o.label
          : typeof o.text === "string"
            ? o.text
            : String(id);
      return { id: id as string | number, label };
    }
    return { id: i, label: String(ch) };
  });
}

export default function ScenarioSimulation({
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

  const scenario = data?.scenario as string | undefined;
  const question = data?.question as string | undefined;
  const choicesRaw = data?.choices ?? data?.options ?? [];
  const choices = useMemo(
    () => normalizeChoices(Array.isArray(choicesRaw) ? choicesRaw : []),
    [data],
  );
  const correctId = data?.correctAnswer ?? data?.correct_choice;
  const explanation = data?.explanation as string | undefined;

  const [selected, setSelected] = useState<string | number | null>(null);
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
            ? t("exercises.widgets.greatChoice")
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

    const correct = selected === correctId;
    onAttempt?.({ correct });

    if (correct) {
      setFeedback(t("exercises.widgets.greatChoice"));
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
      setFeedback(t("exercises.widgets.tryAgainAdjust"));
      setFeedbackType("error");
    }
  };

  return (
    <Card>
      {scenario ? <Text style={styles.scenario}>{scenario}</Text> : null}
      {question ? <Text style={styles.question}>{question}</Text> : null}

      <View style={styles.choices}>
        {choices.map((ch) => {
          const isSel = selected === ch.id;
          return (
            <Pressable
              key={ch.id}
              disabled={isCompleted || disabled}
              onPress={() => {
                setSelected(ch.id);
                setFeedback("");
                setFeedbackType(null);
              }}
              style={[styles.choice, isSel && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, isSel && styles.choiceTextSel]}>
                {ch.label ?? String(ch.id)}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
