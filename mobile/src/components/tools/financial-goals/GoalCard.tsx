import React, { useCallback, useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import type {
  FinancialGoalDto,
  GoalStatus,
} from "../../../types/financial-goals";
import {
  formatGoalDate,
  formatGoalMoney,
  goalProgressPct,
  normalizeStatus,
  num,
} from "../../../types/financial-goals";

type Props = {
  goal: FinancialGoalDto;
  onDelete: (id: number) => void;
  onEdit: (goal: FinancialGoalDto) => void;
  onAddFunds: (goal: FinancialGoalDto) => void;
  statusLabel: (s: GoalStatus) => string;
  labels: {
    target: string;
    current: string;
    targetDate: string;
    notSet: string;
    progress: string;
    remaining: string;
    delete: string;
    edit: string;
    addFunds: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    cancel: string;
  };
};

export function GoalCard({
  goal,
  onDelete,
  onEdit,
  onAddFunds,
  statusLabel,
  labels,
}: Props) {
  const c = useThemeColors();
  const pct = goalProgressPct(goal);
  const status = normalizeStatus(goal);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct / 100,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [pct, widthAnim]);

  const remaining = Math.max(
    num(goal.target_amount) - num(goal.current_amount),
    0,
  );

  const confirmDelete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(labels.deleteConfirmTitle, labels.deleteConfirmMessage, [
      { text: labels.cancel, style: "cancel" },
      {
        text: labels.delete,
        style: "destructive",
        onPress: () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDelete(goal.id);
        },
      },
    ]);
  }, [goal.id, labels, onDelete]);

  const barColor = status === "completed" ? c.success : c.primary;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {goal.goal_name}
        </Text>
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                status === "completed"
                  ? c.successBg
                  : status === "in_progress"
                    ? `${c.primary}22`
                    : c.border,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color:
                  status === "completed"
                    ? c.success
                    : status === "in_progress"
                      ? c.primary
                      : c.textMuted,
              },
            ]}
          >
            {statusLabel(status).toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={[styles.meta, { color: c.textMuted }]}>
        {labels.target}: {formatGoalMoney(num(goal.target_amount))} ·{" "}
        {labels.current}: {formatGoalMoney(num(goal.current_amount))}
      </Text>
      <Text style={[styles.meta, { color: c.textMuted }]}>
        {labels.targetDate}:{" "}
        {goal.deadline ? formatGoalDate(goal.deadline) : labels.notSet}
      </Text>

      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: c.textMuted }]}>
          {labels.progress}
        </Text>
        <Text style={[styles.progressPct, { color: c.text }]}>
          {pct.toFixed(1)}%
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.border }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: barColor,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      <Text style={[styles.remaining, { color: c.textMuted }]}>
        {labels.remaining}: {formatGoalMoney(remaining)}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAddFunds(goal);
          }}
          style={({ pressed }) => [
            styles.btnSecondary,
            { borderColor: c.primary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.btnSecondaryText, { color: c.primary }]}>
            {labels.addFunds}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEdit(goal);
          }}
          style={({ pressed }) => [
            styles.btnSecondary,
            { borderColor: c.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.btnSecondaryText, { color: c.text }]}>
            {labels.edit}
          </Text>
        </Pressable>
        <Pressable
          onPress={confirmDelete}
          style={({ pressed }) => [
            styles.btnDanger,
            { borderColor: c.error, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.btnDangerText, { color: c.error }]}>
            {labels.delete}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: typography.md, fontWeight: "700" },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  meta: { fontSize: typography.xs, marginBottom: 4 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  progressLabel: { fontSize: typography.xs, fontWeight: "600" },
  progressPct: { fontSize: typography.xs, fontWeight: "700" },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 6,
  },
  fill: { height: "100%", borderRadius: 4 },
  remaining: { fontSize: typography.xs, marginTop: spacing.sm },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btnSecondary: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 1,
  },
  btnSecondaryText: { fontSize: typography.sm, fontWeight: "600" },
  btnDanger: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.full,
    borderWidth: 1,
  },
  btnDangerText: { fontSize: typography.sm, fontWeight: "600" },
});
