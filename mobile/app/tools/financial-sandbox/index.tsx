import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";

export default function FinancialSandboxScreen() {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const [monthlyContribution, setMonthlyContribution] = useState("100");
  const [years, setYears] = useState("5");
  const [averageReturn, setAverageReturn] = useState("7");

  const projection = useMemo(() => {
    const months = Math.max(1, Math.round(Number(years) * 12)) || 60;
    const monthlyRate = Math.max(0, Number(averageReturn)) / 100 / 12;
    let balance = 0;
    const contrib = Math.max(0, Number(monthlyContribution));
    for (let i = 0; i < months; i++) {
      balance = (balance + contrib) * (1 + monthlyRate);
    }
    return balance;
  }, [averageReturn, monthlyContribution, years]);

  const formatted = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(projection),
    [projection],
  );

  return (
    <>
      <Stack.Screen options={{ title: t("tools.sandbox.title") }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: c.text }]}>
          {t("tools.sandbox.title")}
        </Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {t("tools.sandbox.subtitle")}
        </Text>

        <View style={[styles.field, { borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("tools.sandbox.monthlyContribution")}
          </Text>
          <TextInput
            value={monthlyContribution}
            onChangeText={setMonthlyContribution}
            keyboardType="decimal-pad"
            placeholder="100"
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
        </View>

        <View style={[styles.field, { borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("tools.sandbox.years")}
          </Text>
          <TextInput
            value={years}
            onChangeText={setYears}
            keyboardType="number-pad"
            placeholder="5"
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
        </View>

        <View style={[styles.field, { borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textMuted }]}>
            {t("tools.sandbox.averageReturn")}
          </Text>
          <TextInput
            value={averageReturn}
            onChangeText={setAverageReturn}
            keyboardType="decimal-pad"
            placeholder="7"
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
        </View>

        <Pressable
          onPress={() =>
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          }
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: c.textOnPrimary }]}>
            {t("tools.sandbox.startProjection")}
          </Text>
        </Pressable>

        <View
          style={[
            styles.tips,
            { borderColor: c.border, backgroundColor: c.surfaceOffset },
          ]}
        >
          <Text style={[styles.tipsTitle, { color: c.textMuted }]}>
            {t("tools.sandbox.tryThis")}
          </Text>
          <Text style={[styles.tipLine, { color: c.textMuted }]}>
            {`• ${t("tools.sandbox.tip1")}`}
          </Text>
          <Text style={[styles.tipLine, { color: c.textMuted }]}>
            {`• ${t("tools.sandbox.tip2")}`}
          </Text>
          <Text style={[styles.tipLine, { color: c.textMuted }]}>
            {`• ${t("tools.sandbox.tip3")}`}
          </Text>
        </View>

        <View
          style={[
            styles.result,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.resultLabel, { color: c.textMuted }]}>
            {t("tools.sandbox.projectedValue", {
              count: Math.max(1, Math.round(Number(years) || 1)),
              years: Math.max(1, Math.round(Number(years) || 1)),
            })}
          </Text>
          <Text style={[styles.resultValue, { color: c.text }]}>
            {formatted}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  title: { fontSize: typography.xl, fontWeight: "800", marginBottom: 8 },
  sub: { fontSize: typography.sm, lineHeight: 20, marginBottom: spacing.lg },
  field: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  label: { fontSize: typography.xs, fontWeight: "700", marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.base,
  },
  cta: {
    minHeight: 48,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  ctaText: { fontSize: typography.sm, fontWeight: "700" },
  tips: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  tipsTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  tipLine: { fontSize: typography.xs, lineHeight: 18, marginBottom: 4 },
  result: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  resultValue: {
    fontSize: typography.xxl,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
});
