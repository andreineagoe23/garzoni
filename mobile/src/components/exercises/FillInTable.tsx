import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  isCompleted: isCompletedProp,
  disabled,
  onAttempt,
  onComplete,
}: Props) {
  const c = useThemeColors();
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

  const handleSubmit = async () => {
    if (disabled) return;
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
      setFeedback("Correct!");
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
      setFeedback("Some cells are incorrect. Try again.");
      setFeedbackType("error");
    }
  };

  return (
    <Card padded={false}>
      <View style={{ padding: spacing.lg }}>
        <Text style={styles.question}>{question}</Text>
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
            style={{ marginTop: spacing.sm }}
          >
            Submit
          </Button>
        ) : null}
      </View>
    </Card>
  );
}
