import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Card, Button } from "../ui";
import { spacing, typography, radius } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";

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
    feedback: { fontSize: typography.sm, fontWeight: "600", marginTop: spacing.md },
    fSuccess: { color: c.success },
    fError: { color: c.error },
  });
}

export default function BudgetAllocation({
  data,
  isCompleted: isCompletedProp,
  disabled,
  onAttempt,
  onComplete,
}: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const question = data?.question as string | undefined;
  const categories = (data?.categories ?? []) as string[];
  const total = Number(data?.total ?? 0);

  const [allocations, setAllocations] = useState<Record<string, string>>(
    () => Object.fromEntries(categories.map((cat) => [cat, ""]))
  );
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null);
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));

  const currentTotal = useMemo(
    () =>
      Object.values(allocations).reduce(
        (sum, v) => sum + (parseInt(v, 10) || 0),
        0
      ),
    [allocations]
  );

  const handleSubmit = async () => {
    if (disabled) return;
    const correct = currentTotal === total;
    onAttempt?.({ correct });

    if (correct) {
      setFeedback("Great allocation!");
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
      setFeedback(`Total must equal ${total}. Current: ${currentTotal}`);
      setFeedbackType("error");
    }
  };

  return (
    <Card>
      <Text style={styles.question}>{question}</Text>
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

      {feedback ? (
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
        >
          Submit
        </Button>
      ) : null}
    </Card>
  );
}
