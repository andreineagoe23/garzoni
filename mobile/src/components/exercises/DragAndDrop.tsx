import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Button, Badge } from "../ui";
import { spacing, typography, radius } from "../../theme/tokens";
import { useThemeColors } from "../../theme/ThemeContext";
import type { ThemeColors } from "../../theme/palettes";

type Item = { id: string | number; label?: string };
type Target = { id: string | number; label?: string };

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

export default function DragAndDrop({
  data,
  isCompleted: isCompletedProp,
  disabled,
  onAttempt,
  onComplete,
}: Props) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);

  const items = (data?.items ?? []) as Item[];
  const targets = (data?.targets ?? []) as Target[];
  const explanation = data?.explanation as string | undefined;

  const [order, setOrder] = useState<(string | number)[]>([]);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null);
  const [isCompleted, setIsCompleted] = useState(Boolean(isCompletedProp));

  const available = useMemo(
    () => items.filter((it) => !order.includes(it.id)),
    [items, order]
  );

  const correctOrder = useMemo(
    () => targets.map((t) => t.id),
    [targets]
  );

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

  const handleSubmit = async () => {
    if (disabled) return;
    const allCorrect =
      order.length === correctOrder.length &&
      order.every((id, i) => id === correctOrder[i]);

    onAttempt?.({ correct: allCorrect });

    if (allCorrect) {
      setFeedback("Perfect order!");
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
      setFeedback("That's not the right order. Try again.");
      setFeedbackType("error");
      setOrder([]);
    }
  };

  const itemLabel = (id: string | number) =>
    items.find((it) => it.id === id)?.label ?? String(id);

  return (
    <Card>
      <Text style={styles.question}>
        {(data?.question as string) ?? "Tap items in the correct order"}
      </Text>

      {order.length > 0 ? (
        <View style={styles.placed}>
          {order.map((id, i) => (
            <Badge key={`${id}-${i}`} label={`${i + 1}. ${itemLabel(id)}`} color={c.accent} />
          ))}
          {!isCompleted ? (
            <Pressable onPress={handleUndo}>
              <Text style={styles.undo}>Undo</Text>
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

      {!isCompleted && order.length === items.length ? (
        <Button size="sm" onPress={() => void handleSubmit()} style={{ marginTop: spacing.md }}>
          Check order
        </Button>
      ) : null}
    </Card>
  );
}
