import React, { useEffect, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { submitExerciseAnswer } from "@garzoni/core";
import { Button } from "../ui";
import { spacing, typography, radius } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
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
};

function isWithinTolerance(
  userNum: number,
  expected: number,
  tolerance: number | undefined,
): boolean {
  if (tolerance == null || tolerance === 0) {
    return userNum === expected;
  }
  return Math.abs(userNum - expected) <= Math.abs(tolerance);
}

export default function NumericInput({
  data,
  exerciseId,
  sectionId,
  isCompleted,
  disabled,
  onAttempt,
  onComplete,
  gradingMode = "lesson",
  hintsUsed = 0,
  onStandaloneSubmitResult,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue("");
    setResult(null);
    setSubmitting(false);
  }, [exerciseId, sectionId, data]);

  const question = String(data.question ?? "");
  const prompt = data.prompt ? String(data.prompt) : null;
  const placeholder = data.placeholder
    ? String(data.placeholder)
    : "Enter a number";
  const unit = data.unit ? String(data.unit) : null;
  const expectedRaw = data.expected_value ?? data.correct_answer;
  const expected = expectedRaw != null ? Number(expectedRaw) : null;
  const tolerance = data.tolerance != null ? Number(data.tolerance) : undefined;

  const done =
    isCompleted ||
    (gradingMode === "lesson" ? result === "correct" : result === "correct");

  function handleSubmit() {
    if (done || disabled || !value.trim() || submitting) return;
    Keyboard.dismiss();

    const userNum = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(userNum)) return;

    if (gradingMode === "standalone" && exerciseId != null) {
      setSubmitting(true);
      void (async () => {
        try {
          const { data: res } = await submitExerciseAnswer(exerciseId, {
            user_answer: userNum,
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
          void Haptics.notificationAsync(
            res.correct
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Error,
          );
          if (res.correct) {
            setResult("correct");
            try {
              await onComplete?.();
            } catch {
              onStandaloneSubmitResult?.({
                correct: false,
                feedback: t("exercises.widgets.couldNotSave"),
              });
              setResult(null);
            }
          } else {
            setResult("wrong");
          }
        } catch {
          const msg = t("exercises.errors.submissionFailed");
          onStandaloneSubmitResult?.({ correct: false, feedback: msg });
          onAttempt?.({ correct: false });
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          );
        } finally {
          setSubmitting(false);
        }
      })();
      return;
    }

    if (expected === null) return;

    const correct = isWithinTolerance(userNum, expected, tolerance);
    setResult(correct ? "correct" : "wrong");
    void Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    onAttempt?.({ correct });
    if (correct) {
      void onComplete?.();
    }
  }

  const inputBorderColor =
    result === "correct" ? c.success : result === "wrong" ? c.error : c.border;

  const inputBg =
    result === "correct"
      ? `${c.success}18`
      : result === "wrong"
        ? `${c.error}18`
        : c.surface;

  return (
    <View style={styles.root}>
      {question ? (
        <Text style={[styles.question, { color: c.text }]}>{question}</Text>
      ) : null}
      {prompt ? (
        <Text style={[styles.prompt, { color: c.textMuted }]}>{prompt}</Text>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              color: c.text,
              backgroundColor: inputBg,
              borderColor: inputBorderColor,
            },
          ]}
          value={value}
          onChangeText={(v) => {
            setValue(v);
            if (gradingMode === "standalone") setResult(null);
          }}
          placeholder={placeholder}
          placeholderTextColor={c.textFaint}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!done && !disabled}
          selectTextOnFocus
        />
        {unit ? (
          <View
            style={[
              styles.unit,
              { borderColor: c.border, backgroundColor: c.surfaceOffset },
            ]}
          >
            <Text style={[styles.unitText, { color: c.textMuted }]}>
              {unit}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Feedback (lesson mode only — standalone uses parent banner) */}
      {gradingMode === "lesson" && result === "correct" ? (
        <Text style={[styles.feedback, { color: c.success }]}>
          {t("exercises.widgets.correctShort")}
        </Text>
      ) : gradingMode === "lesson" && result === "wrong" ? (
        <View>
          <Text style={[styles.feedback, { color: c.error }]}>
            {t("exercises.widgets.notQuiteTryAgain")}
          </Text>
          {expected !== null && (
            <Text style={[styles.reveal, { color: c.textMuted }]}>
              {tolerance
                ? `Expected ${expected} ± ${tolerance}`
                : `Expected ${expected}`}
            </Text>
          )}
        </View>
      ) : null}

      {!done && !disabled ? (
        <Button
          onPress={handleSubmit}
          disabled={!value.trim()}
          loading={submitting}
          style={styles.submitBtn}
        >
          {t("exercises.widgets.checkAnswer")}
        </Button>
      ) : null}

      {result === "wrong" ? (
        <Pressable
          onPress={() => {
            setValue("");
            setResult(null);
          }}
          style={styles.retryBtn}
        >
          <Text style={[styles.retryText, { color: c.primary }]}>
            Try again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  question: {
    fontSize: typography.md,
    fontWeight: "600",
    lineHeight: 24,
  },
  prompt: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.base,
    minHeight: 48,
  },
  unit: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  unitText: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
  feedback: {
    fontSize: typography.sm,
    fontWeight: "700",
  },
  reveal: {
    fontSize: typography.sm,
    marginTop: spacing.xs,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  retryBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  retryText: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
});
