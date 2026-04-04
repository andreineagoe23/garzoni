import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Button } from "../ui";
import { spacing, typography, radius } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";

type Choice = { id: string | number; label: string };

type Props = {
  data: Record<string, unknown>;
  exerciseId?: string | number;
  isCompleted?: boolean;
  disabled?: boolean;
  onAttempt?: (payload: { correct: boolean }) => void;
  onComplete?: () => Promise<void> | void;
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
    feedback: { fontSize: typography.sm, fontWeight: "600", marginTop: spacing.md },
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

export default function ScenarioSimulation({
  data,
  isCompleted: isCompletedProp,
  disabled,
  onAttempt,
  onComplete,
}: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

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
                {ch.label}
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
