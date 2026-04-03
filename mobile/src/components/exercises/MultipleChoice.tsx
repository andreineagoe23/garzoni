import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Card, Button } from "../ui";
import { colors, spacing, typography, radius } from "../../theme/tokens";

type Props = {
  data: Record<string, unknown>;
  exerciseId?: string | number;
  isCompleted?: boolean;
  disabled?: boolean;
  onAttempt?: (payload: { correct: boolean }) => void;
  onComplete?: () => Promise<void> | void;
};

export default function MultipleChoice({
  data,
  exerciseId,
  isCompleted: isCompletedProp,
  disabled,
  onAttempt,
  onComplete,
}: Props) {
  const question = data?.question as string | undefined;
  const options = (data?.options ?? []) as string[];
  const correctAnswer = data?.correctAnswer as number | undefined;
  const explanation = data?.explanation as string | undefined;

  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null);
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));

  const handleSubmit = async () => {
    if (disabled || selected === null) return;

    const correct = selected === correctAnswer;
    onAttempt?.({ correct });

    if (correct) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback("Correct!");
      setFeedbackType("success");
      setIsCompleted(true);
      try {
        await onComplete?.();
      } catch {
        setFeedback("Could not save progress.");
        setFeedbackType("error");
        setIsCompleted(false);
      }
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback("Not quite. Try again.");
      setFeedbackType("error");
    }
  };

  return (
    <Card>
      <Text style={styles.question}>{question}</Text>
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

      {feedback ? (
        <Text
          style={[
            styles.feedback,
            feedbackType === "success" ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          {feedback}
        </Text>
      ) : null}

      {explanation && isCompleted ? (
        <Text style={styles.explanation}>{explanation}</Text>
      ) : null}

      {!isCompleted && selected !== null ? (
        <Button size="sm" onPress={() => void handleSubmit()} style={{ marginTop: spacing.md }}>
          Submit
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  question: {
    fontSize: typography.md,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  options: { gap: spacing.sm },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  optionWrong: {
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  optionText: { fontSize: typography.base, color: colors.text },
  optionTextSelected: { fontWeight: "600" },
  feedback: {
    fontSize: typography.sm,
    fontWeight: "600",
    marginTop: spacing.md,
  },
  feedbackSuccess: { color: colors.success },
  feedbackError: { color: colors.error },
  explanation: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
