import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { apiClient } from "@monevo/core";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import type { FinancialGoalDto } from "../../../types/financial-goals";
import {
  EMPTY_GOAL_FORM,
  type GoalFormState,
  num,
} from "../../../types/financial-goals";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP = Math.min(SCREEN_HEIGHT * 0.88, SCREEN_HEIGHT - 48);

export type SheetMode = "create" | "edit" | "addFunds";

type Props = {
  visible: boolean;
  mode: SheetMode;
  goal: FinancialGoalDto | null;
  onClose: () => void;
  onSaved: () => void;
  labels: {
    newGoal: string;
    editGoal: string;
    addFundsTitle: string;
    goalName: string;
    targetAmount: string;
    currentAmount: string;
    targetDate: string;
    amount: string;
    save: string;
    cancel: string;
    add: string;
    requestFailed: string;
    positiveAmount: string;
    placeholders: {
      goalName: string;
      target: string;
      current: string;
      amount: string;
    };
  };
};

function dtoToForm(g: FinancialGoalDto): GoalFormState {
  return {
    goal_name: g.goal_name ?? "",
    target_amount: String(g.target_amount ?? ""),
    current_amount: String(g.current_amount ?? ""),
    deadline: g.deadline ? String(g.deadline).slice(0, 10) : "",
  };
}

export function GoalFormSheet({
  visible,
  mode,
  goal,
  onClose,
  onSaved,
  labels,
}: Props) {
  const c = useThemeColors();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [form, setForm] = useState<GoalFormState>(EMPTY_GOAL_FORM);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (mode === "addFunds") {
        setAmount("");
        setError(null);
      } else if (mode === "edit" && goal) {
        setForm(dtoToForm(goal));
        setError(null);
      } else if (mode === "create") {
        setForm(EMPTY_GOAL_FORM);
        setError(null);
      }
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - SNAP,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, mode, goal, translateY]);

  const title =
    mode === "create"
      ? labels.newGoal
      : mode === "edit"
        ? labels.editGoal
        : labels.addFundsTitle;

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "addFunds") {
        if (!goal) return;
        const a = num(amount);
        if (a <= 0) {
          setError(labels.positiveAmount);
          setSubmitting(false);
          return;
        }
        await (apiClient as any).post(`/financial-goals/${goal.id}/add_funds/`, {
          amount: String(a),
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSaved();
        onClose();
      } else if (mode === "edit" && goal) {
        await (apiClient as any).patch(`/financial-goals/${goal.id}/`, {
          goal_name: form.goal_name.trim(),
          target_amount: form.target_amount,
          current_amount: form.current_amount,
          deadline: form.deadline || null,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSaved();
        onClose();
      } else {
        await (apiClient as any).post("/financial-goals/", {
          goal_name: form.goal_name.trim(),
          target_amount: form.target_amount,
          current_amount: form.current_amount,
          deadline: form.deadline,
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSaved();
        onClose();
      }
    } catch {
      setError(labels.requestFailed);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }, [amount, form, goal, labels.positiveAmount, labels.requestFailed, mode, onClose, onSaved]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdropTap} onPress={onClose}>
        <View style={[styles.backdropFill, { backgroundColor: c.overlay }]} />
      </Pressable>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetBody}
          >
              {mode === "addFunds" ? (
                <>
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    {labels.amount}
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder={labels.placeholders.amount}
                    placeholderTextColor={c.textFaint}
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        borderColor: c.border,
                        backgroundColor: c.inputBg,
                      },
                    ]}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    {labels.goalName}
                  </Text>
                  <TextInput
                    value={form.goal_name}
                    onChangeText={(v) => setForm((p) => ({ ...p, goal_name: v }))}
                    placeholder={labels.placeholders.goalName}
                    placeholderTextColor={c.textFaint}
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        borderColor: c.border,
                        backgroundColor: c.inputBg,
                      },
                    ]}
                  />
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    {labels.targetAmount}
                  </Text>
                  <TextInput
                    value={form.target_amount}
                    onChangeText={(v) => setForm((p) => ({ ...p, target_amount: v }))}
                    keyboardType="decimal-pad"
                    placeholder={labels.placeholders.target}
                    placeholderTextColor={c.textFaint}
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        borderColor: c.border,
                        backgroundColor: c.inputBg,
                      },
                    ]}
                  />
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    {labels.currentAmount}
                  </Text>
                  <TextInput
                    value={form.current_amount}
                    onChangeText={(v) => setForm((p) => ({ ...p, current_amount: v }))}
                    keyboardType="decimal-pad"
                    placeholder={labels.placeholders.current}
                    placeholderTextColor={c.textFaint}
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        borderColor: c.border,
                        backgroundColor: c.inputBg,
                      },
                    ]}
                  />
                  <Text style={[styles.label, { color: c.textMuted }]}>
                    {labels.targetDate}
                  </Text>
                  <TextInput
                    value={form.deadline}
                    onChangeText={(v) => setForm((p) => ({ ...p, deadline: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={c.textFaint}
                    style={[
                      styles.input,
                      {
                        color: c.text,
                        borderColor: c.border,
                        backgroundColor: c.inputBg,
                      },
                    ]}
                  />
                </>
              )}
              {error ? (
                <Text style={[styles.err, { color: c.error }]}>{error}</Text>
              ) : null}
              <View style={styles.rowBtns}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.btnGhost,
                    { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.btnGhostText, { color: c.text }]}>
                    {labels.cancel}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleSubmit()}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    {
                      backgroundColor: c.primary,
                      opacity: submitting || pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.btnPrimaryText, { color: c.textOnPrimary }]}>
                    {mode === "addFunds" ? labels.add : labels.save}
                  </Text>
                </Pressable>
              </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdropFill: { flex: 1 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { fontSize: typography.sm, fontWeight: "600", marginBottom: 6, marginTop: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    fontSize: typography.sm,
  },
  err: { marginTop: spacing.sm, fontSize: typography.sm },
  rowBtns: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  btnGhost: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostText: { fontSize: typography.sm, fontWeight: "600" },
  btnPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { fontSize: typography.sm, fontWeight: "700" },
});
