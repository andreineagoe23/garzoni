import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Button } from "../ui";
import { colors, spacing, typography, radius } from "../../theme/tokens";

type Choice = { id: string | number; label: string };

type Props = {
  data: Record<string, unknown>;
  exerciseId?: string | number;
  isCompleted?: boolean;
  disabled?: boolean;
  onAttempt?: (payload: { correct: boolean }) => void;
  onComplete?: () => Promise<void> | void;
};

export default function ScenarioSimulation({
  data,
  isCompleted: isCompletedProp,
  disabled,
  onAttempt,
  onComplete,
}: Props) {
  const scenario = data?.scenario as string | undefined;
  const question = data?.question as string | undefined;
  const choices = (data?.choices ?? data?.options ?? []) as Choice[];
  const correctId = data?.correctAnswer ?? data?.correct_choice;
  const explanation = data?.explanation as string | undefined;

  const [selected, setSelected] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null);
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));

  const handleSubmit = async () => {
    if (disabled || selected === null) return;
    const correct = selected === correctId;
    onAttempt?.({ correct });

    if (correct) {
      setFeedback("Great choice!");
      setFeedbackType("success");
      setIsCompleted(true);
      try {
        await onComplete?.();
      } catch {
        setFeedback("Could not save.");
        setFeedbackType("error");
        setIsCompleted(false);
      }
    } else {
      setFeedback("Not the best option. Try again.");
      setFeedbackType("error");
    }
  };

  return (
    <Card>
      {scenario ? <Text style={styles.scenario}>{scenario}</Text> : null}
      <Text style={styles.question}>{question}</Text>

      <View style={styles.choices}>
        {choices.map((c) => {
          const isSel = selected === c.id;
          return (
            <Pressable
              key={c.id}
              disabled={isCompleted || disabled}
              onPress={() => {
                setSelected(c.id);
                setFeedback("");
                setFeedbackType(null);
              }}
              style={[styles.choice, isSel && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, isSel && styles.choiceTextSel]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {feedback ? (
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
        <Button size="sm" onPress={() => void handleSubmit()} style={{ marginTop: spacing.md }}>
          Submit
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  scenario: {
    fontSize: typography.base,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  question: {
    fontSize: typography.md,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  choices: { gap: spacing.sm },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  choiceText: { fontSize: typography.base, color: colors.text },
  choiceTextSel: { fontWeight: "600" },
  feedback: { fontSize: typography.sm, fontWeight: "600", marginTop: spacing.md },
  fOk: { color: colors.success },
  fErr: { color: colors.error },
  explanation: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
