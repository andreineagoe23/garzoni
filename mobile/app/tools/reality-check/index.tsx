import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";
import { useScreenGutter } from "../../../src/utils/platform";
import { calcRealityCheck } from "../../../src/types/reality-check";
import type {
  RealityCheckForm,
  RealityCheckResult,
} from "../../../src/types/reality-check";
import { InputSheet } from "../../../src/components/tools/reality-check/InputSheet";
import { ResultCard } from "../../../src/components/tools/reality-check/ResultCard";
import { ProjectionChart } from "../../../src/components/tools/reality-check/ProjectionChart";
import { href } from "../../../src/navigation/href";
import { useCfoProfile, hasProfileInputs } from "../../../src/state/cfoProfile";
import WhyThisMattersMobile from "../../../src/components/tools/WhyThisMattersMobile";

const EMPTY_FORM: RealityCheckForm = {
  goalName: "",
  goalAmount: "",
  months: "",
  currentSaved: "",
  incomeLow: "",
  incomeHigh: "",
  expenseLow: "",
  expenseHigh: "",
};

const DEMO_FORM: RealityCheckForm = {
  goalName: "Emergency Fund",
  goalAmount: "6000",
  months: "12",
  currentSaved: "900",
  incomeLow: "2800",
  incomeHigh: "3200",
  expenseLow: "1900",
  expenseHigh: "2200",
};

export default function RealityCheckScreen() {
  const c = useThemeColors();
  const gutter = useScreenGutter();
  const router = useRouter();
  const { profile, setProfile, hydrated } = useCfoProfile();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [form, setForm] = useState<RealityCheckForm>(EMPTY_FORM);
  const [result, setResult] = useState<RealityCheckResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const seededRef = useRef(false);

  // Seed local form from shared profile once hydrated, and auto-compute
  // result if the profile already contains the inputs.
  useEffect(() => {
    if (!hydrated || seededRef.current) return;
    if (!hasProfileInputs(profile)) {
      seededRef.current = true;
      return;
    }
    const seeded: RealityCheckForm = {
      goalName: profile.goalName,
      goalAmount: profile.goalAmount,
      months: profile.months,
      currentSaved: profile.currentSaved,
      incomeLow: profile.incomeLow,
      incomeHigh: profile.incomeHigh,
      expenseLow: profile.expenseLow,
      expenseHigh: profile.expenseHigh,
    };
    setForm(seeded);
    const r = calcRealityCheck(seeded);
    setResult(r);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    seededRef.current = true;
  }, [hydrated, profile, fadeAnim]);

  const handleChange = useCallback(
    (field: keyof RealityCheckForm, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const calculate = useCallback(() => {
    const r = calcRealityCheck(form);
    setResult(r);
    setSheetVisible(false);

    setProfile({
      goalName: form.goalName,
      goalAmount: form.goalAmount,
      months: form.months,
      currentSaved: form.currentSaved,
      incomeLow: form.incomeLow,
      incomeHigh: form.incomeHigh,
      expenseLow: form.expenseLow,
      expenseHigh: form.expenseHigh,
      requiredMonthly: r.requiredMonthly,
    });

    if (r.warnings.length === 0 && r.requiredMonthly > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (r.warnings.length >= 2) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [form, fadeAnim, setProfile]);

  const loadDemo = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(DEMO_FORM);
    const r = calcRealityCheck(DEMO_FORM);
    setResult(r);
    setProfile({
      ...DEMO_FORM,
      requiredMonthly: r.requiredMonthly,
    });
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, setProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setResult(null);
    setForm(EMPTY_FORM);
    fadeAnim.setValue(0);
    setTimeout(() => setRefreshing(false), 300);
  }, [fadeAnim]);

  const hasInputs = Boolean(form.goalAmount || form.months || form.incomeLow);

  return (
    <>
      <Stack.Screen options={{ title: "Goals Reality Check" }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.xl + gutter },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <WhyThisMattersMobile toolSlug="reality-check" />
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.heroTitle, { color: c.text }]}>
            Goals Reality Check
          </Text>
          <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
            Is your savings goal actually achievable given your income and
            expenses?
          </Text>
        </View>

        {/* CTA buttons */}
        <View style={styles.btnRow}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSheetVisible(true);
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>
              {result ? "Edit Inputs" : "Enter Details"}
            </Text>
          </Pressable>

          {!result && (
            <Pressable
              onPress={loadDemo}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  backgroundColor: c.surfaceOffset,
                  borderColor: c.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryBtnText, { color: c.textMuted }]}>
                Try Demo
              </Text>
            </Pressable>
          )}
        </View>

        {/* Results */}
        {result && (
          <Animated.View style={[styles.results, { opacity: fadeAnim }]}>
            <ResultCard result={result} goalName={form.goalName} />
            {result.projection.length > 1 && (
              <ProjectionChart
                data={result.projection}
                goalAmount={Number(form.goalAmount || 0)}
              />
            )}

            <View style={styles.linkRow}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(href("/(tabs)/tools/savings-goals"));
                }}
                style={({ pressed }) => [
                  styles.linkBtn,
                  {
                    backgroundColor: c.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.linkBtnText, { color: c.textOnPrimary }]}
                  numberOfLines={1}
                >
                  Project these savings →
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(href("/(tabs)/tools/budget-planner"));
                }}
                style={({ pressed }) => [
                  styles.linkBtnSecondary,
                  {
                    backgroundColor: c.surfaceOffset,
                    borderColor: c.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.linkBtnSecondaryText, { color: c.text }]}
                  numberOfLines={1}
                >
                  Track in budget →
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Empty state */}
        {!result && (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.emptyIcon]}>🎯</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              Check Your Goal
            </Text>
            <Text style={[styles.emptyBody, { color: c.textMuted }]}>
              Enter your goal amount, timeline, and income/expenses to see if
              you're on track.
            </Text>
          </View>
        )}
      </ScrollView>

      <InputSheet
        visible={sheetVisible}
        form={form}
        onChange={handleChange}
        onClose={() => setSheetVisible(false)}
        onCalculate={calculate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  headerSection: { gap: spacing.xs },
  heroTitle: {
    fontSize: typography.xxl,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSubtitle: { fontSize: typography.sm, lineHeight: 20 },
  btnRow: { flexDirection: "row", gap: spacing.md },
  primaryBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryBtnText: { fontSize: typography.base, fontWeight: "700" },
  secondaryBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: typography.base, fontWeight: "600" },
  results: { gap: spacing.lg },
  linkRow: { flexDirection: "row", gap: spacing.md },
  linkBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  linkBtnText: { fontSize: typography.sm, fontWeight: "700" },
  linkBtnSecondary: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    borderWidth: 1,
  },
  linkBtnSecondaryText: { fontSize: typography.sm, fontWeight: "600" },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: typography.lg, fontWeight: "700" },
  emptyBody: { fontSize: typography.sm, textAlign: "center", lineHeight: 20 },
});
