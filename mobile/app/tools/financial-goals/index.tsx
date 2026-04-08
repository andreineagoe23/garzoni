import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { apiClient } from "@garzoni/core";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";
import type {
  FinancialGoalDto,
  GoalStatus,
} from "../../../src/types/financial-goals";
import {
  EMPTY_GOAL_FORM,
  type GoalFormState,
} from "../../../src/types/financial-goals";
import { GoalsSkeleton } from "../../../src/components/tools/financial-goals/GoalsSkeleton";
import { GoalCard } from "../../../src/components/tools/financial-goals/GoalCard";
import {
  GoalFormSheet,
  type SheetMode,
} from "../../../src/components/tools/financial-goals/GoalFormSheet";

function isGoalList(data: unknown): data is FinancialGoalDto[] {
  return Array.isArray(data);
}

export default function FinancialGoalsScreen() {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const [goals, setGoals] = useState<FinancialGoalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [selectedGoal, setSelectedGoal] = useState<FinancialGoalDto | null>(
    null,
  );

  const presets = useMemo(
    () => [
      {
        label: t("tools.goalsTracker.presetEmergency"),
        values: {
          ...EMPTY_GOAL_FORM,
          goal_name: t("tools.goalsTracker.defaultGoalName"),
          target_amount: "10000",
          current_amount: "1000",
          deadline: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1),
          )
            .toISOString()
            .split("T")[0],
        } satisfies GoalFormState,
      },
      {
        label: t("tools.goalsTracker.presetVacation"),
        values: {
          ...EMPTY_GOAL_FORM,
          goal_name: "Vacation Trip",
          target_amount: "3000",
          current_amount: "500",
          deadline: new Date(new Date().setMonth(new Date().getMonth() + 6))
            .toISOString()
            .split("T")[0],
        } satisfies GoalFormState,
      },
    ],
    [t],
  );

  const fetchGoals = useCallback(async () => {
    try {
      const res = await (apiClient as any).get("/financial-goals/");
      const raw = res.data;
      const list = isGoalList(raw) ? raw : raw?.results;
      setGoals(Array.isArray(list) ? list : []);
      setError(null);
    } catch {
      setError(t("tools.goalsTracker.loadFailed"));
      setGoals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchGoals();
  }, [fetchGoals]);

  const openCreate = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGoal(null);
    setSheetMode("create");
    setSheetOpen(true);
  }, []);

  const openEdit = useCallback((goal: FinancialGoalDto) => {
    setSelectedGoal(goal);
    setSheetMode("edit");
    setSheetOpen(true);
  }, []);

  const openAddFunds = useCallback((goal: FinancialGoalDto) => {
    setSelectedGoal(goal);
    setSheetMode("addFunds");
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await (apiClient as any).delete(`/financial-goals/${id}/`);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setGoals((prev) => prev.filter((g) => g.id !== id));
      } catch {
        Alert.alert("", t("tools.goalsTracker.deleteFailed"));
      }
    },
    [t],
  );

  const quickAddFromPresets = useCallback(
    async (values: GoalFormState) => {
      try {
        const res = await (apiClient as any).post("/financial-goals/", {
          goal_name: values.goal_name.trim(),
          target_amount: values.target_amount,
          current_amount: values.current_amount,
          deadline: values.deadline,
        });
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setGoals((prev) => [...prev, res.data as FinancialGoalDto]);
        setError(null);
      } catch {
        Alert.alert("", t("tools.goalsTracker.addFailed"));
      }
    },
    [t],
  );

  const statusLabel = useCallback(
    (s: GoalStatus) => {
      if (s === "completed") return t("tools.goalsTracker.statusCompleted");
      if (s === "in_progress") return t("tools.goalsTracker.statusInProgress");
      return t("tools.goalsTracker.statusNotStarted");
    },
    [t],
  );

  const cardLabels = useMemo(
    () => ({
      target: t("tools.goalsTracker.target"),
      current: t("tools.goalsTracker.current"),
      targetDate: t("tools.goalsTracker.targetDateLabel"),
      notSet: t("tools.goalsTracker.notSet"),
      progress: t("tools.goalsTracker.progress"),
      remaining: t("tools.goalsTracker.remaining"),
      delete: t("tools.goalsTracker.delete"),
      edit: t("tools.goalsTracker.edit"),
      addFunds: t("tools.goalsTracker.addFunds"),
      deleteConfirmTitle: t("tools.goalsTracker.deleteGoalTitle"),
      deleteConfirmMessage: t("tools.goalsTracker.deleteGoalMessage"),
      cancel: t("tools.goalsTracker.cancel"),
    }),
    [t],
  );

  const sheetLabels = useMemo(
    () => ({
      newGoal: t("tools.goalsTracker.newGoalSheet"),
      editGoal: t("tools.goalsTracker.editGoalSheet"),
      addFundsTitle: t("tools.goalsTracker.addFundsSheet"),
      goalName: t("tools.goalsTracker.goalName"),
      targetAmount: t("tools.goalsTracker.targetAmount"),
      currentAmount: t("tools.goalsTracker.currentAmount"),
      targetDate: t("tools.goalsTracker.targetDate"),
      amount: t("tools.goalsTracker.amount"),
      save: t("tools.goalsTracker.save"),
      cancel: t("tools.goalsTracker.cancel"),
      add: t("tools.goalsTracker.addAmount"),
      requestFailed: t("tools.goalsTracker.requestFailed"),
      positiveAmount: t("tools.goalsTracker.positiveAmount"),
      placeholders: {
        goalName: t("tools.goalsTracker.goalNamePlaceholder"),
        target: t("tools.goalsTracker.targetAmountPlaceholder"),
        current: t("tools.goalsTracker.currentAmountPlaceholder"),
        amount: t("tools.goalsTracker.amountPlaceholder"),
      },
    }),
    [t],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <Text style={[styles.heroTitle, { color: c.text }]}>
          {t("tools.goalsTracker.title")}
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          {t("tools.goalsTracker.subtitle")}
        </Text>

        <View
          style={[
            styles.presetCard,
            { backgroundColor: c.surfaceOffset, borderColor: c.border },
          ]}
        >
          <Text style={[styles.presetLabel, { color: c.textMuted }]}>
            {t("tools.goalsTracker.demoPresets")}
          </Text>
          <View style={styles.presetRow}>
            {presets.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void quickAddFromPresets(p.values);
                }}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    borderColor: c.border,
                    backgroundColor: c.surface,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.presetChipText, { color: c.text }]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.tip, { color: c.textMuted }]}>
            {`• ${t("tools.goalsTracker.presetTip1")}`}
          </Text>
          <Text style={[styles.tip, { color: c.textMuted }]}>
            {`• ${t("tools.goalsTracker.presetTip2")}`}
          </Text>
          <Text style={[styles.tip, { color: c.textMuted }]}>
            {`• ${t("tools.goalsTracker.presetTip3")}`}
          </Text>
        </View>

        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>
            {t("tools.goalsTracker.addGoalFab")}
          </Text>
        </Pressable>

        {error ? (
          <Text style={[styles.errBanner, { color: c.error }]}>{error}</Text>
        ) : null}
      </View>
    ),
    [c, error, openCreate, presets, quickAddFromPresets, t],
  );

  const emptyFooter =
    !loading && goals.length === 0 && !error ? (
      <View
        style={[
          styles.emptyBox,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Text style={[styles.emptyTitle, { color: c.text }]}>
          {t("tools.goalsTracker.emptyTitle")}
        </Text>
        <Text style={[styles.emptySub, { color: c.textMuted }]}>
          {t("tools.goalsTracker.emptySubtitle")}
        </Text>
      </View>
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: t("tools.goalsTracker.title") }} />
      {loading ? (
        <View style={[styles.loaderRoot, { backgroundColor: c.bg }]}>
          <GoalsSkeleton />
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <>
              {listHeader}
              {emptyFooter}
            </>
          }
          renderItem={({ item }) => (
            <GoalCard
              goal={item}
              onDelete={handleDelete}
              onEdit={openEdit}
              onAddFunds={openAddFunds}
              statusLabel={statusLabel}
              labels={cardLabels}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { backgroundColor: c.bg },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
            />
          }
        />
      )}
      <GoalFormSheet
        visible={sheetOpen}
        mode={sheetMode}
        goal={selectedGoal}
        onClose={() => setSheetOpen(false)}
        onSaved={() => void fetchGoals()}
        labels={sheetLabels}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loaderRoot: { flex: 1, padding: spacing.lg },
  listContent: { padding: spacing.lg, paddingBottom: 48 },
  headerBlock: { marginBottom: spacing.md },
  heroTitle: { fontSize: typography.xl, fontWeight: "800", marginBottom: 6 },
  heroSub: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  presetCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  presetChipText: { fontSize: 12, fontWeight: "700" },
  tip: { fontSize: 12, lineHeight: 18 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  primaryBtnText: { fontSize: typography.sm, fontWeight: "700" },
  errBanner: { fontSize: typography.sm, marginBottom: spacing.sm },
  emptyBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: typography.md, fontWeight: "700", marginBottom: 6 },
  emptySub: { fontSize: typography.sm, lineHeight: 20 },
});
