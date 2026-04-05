import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../../../src/theme/ThemeContext';
import { spacing, typography, radius, shadows } from '../../../src/theme/tokens';
import { calcSavings } from '../../../src/types/savings-calculator';
import type { SavingsForm } from '../../../src/types/savings-calculator';
import { ResultSummary } from '../../../src/components/tools/savings-calculator/ResultSummary';
import { GrowthChart } from '../../../src/components/tools/savings-calculator/GrowthChart';

const PRESETS: { label: string; values: SavingsForm }[] = [
  {
    label: 'Starter',
    values: {
      savingsGoal: '10000',
      initialAmount: '1000',
      monthlyContribution: '300',
      annualRate: '5',
      years: '2',
    },
  },
  {
    label: 'Long-term',
    values: {
      savingsGoal: '50000',
      initialAmount: '5000',
      monthlyContribution: '500',
      annualRate: '6',
      years: '10',
    },
  },
  {
    label: 'Retirement',
    values: {
      savingsGoal: '500000',
      initialAmount: '10000',
      monthlyContribution: '1000',
      annualRate: '7',
      years: '30',
    },
  },
];

const EMPTY: SavingsForm = {
  savingsGoal: '',
  initialAmount: '',
  monthlyContribution: '',
  annualRate: '',
  years: '',
};

export default function SavingsCalculatorScreen() {
  const c = useThemeColors();
  const [form, setForm] = useState<SavingsForm>(EMPTY);

  const result = useMemo(() => {
    if (!form.initialAmount && !form.monthlyContribution) return null;
    if (!form.years || Number(form.years) <= 0) return null;
    return calcSavings(form);
  }, [form]);

  const setField = useCallback((key: keyof SavingsForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyPreset = useCallback((preset: SavingsForm) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(preset);
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Savings Calculator' }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <Text style={[styles.heroTitle, { color: c.text }]}>Savings Calculator</Text>
          <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
            Project your savings growth with compound interest
          </Text>
        </View>

        {/* Presets */}
        <View style={styles.presetRow}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => applyPreset(p.values)}
              style={({ pressed }) => [
                styles.presetChip,
                {
                  backgroundColor:
                    form.savingsGoal === p.values.savingsGoal ? c.primary : c.surfaceOffset,
                  borderColor:
                    form.savingsGoal === p.values.savingsGoal ? c.primary : c.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetLabel,
                  {
                    color: form.savingsGoal === p.values.savingsGoal ? c.textOnPrimary : c.textMuted,
                  },
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Inputs */}
        <View style={[styles.inputCard, { backgroundColor: c.surface, borderColor: c.border }, shadows.sm]}>
          <Field label="Savings Goal ($)" value={form.savingsGoal} onChange={(v) => setField('savingsGoal', v)} placeholder="e.g. 10000" colors={c} />
          <Field label="Initial Amount ($)" value={form.initialAmount} onChange={(v) => setField('initialAmount', v)} placeholder="e.g. 1000" colors={c} />
          <Field label="Monthly Contribution ($)" value={form.monthlyContribution} onChange={(v) => setField('monthlyContribution', v)} placeholder="e.g. 300" colors={c} />
          <Field label="Annual Interest Rate (%)" value={form.annualRate} onChange={(v) => setField('annualRate', v)} placeholder="e.g. 5" colors={c} />
          <Field label="Years to Grow" value={form.years} onChange={(v) => setField('years', v)} placeholder="e.g. 5" colors={c} last />
        </View>

        {/* Results */}
        {result && (
          <>
            <ResultSummary result={result} goalAmount={Number(form.savingsGoal || 0)} />
            <GrowthChart data={result.chartData} goalAmount={Number(form.savingsGoal || 0)} />
          </>
        )}

        {!result && (
          <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Results appear here</Text>
            <Text style={[styles.emptyBody, { color: c.textMuted }]}>
              Fill in your numbers above or tap a preset to see your projection instantly.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  colors,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useThemeColors>;
  last?: boolean;
}) {
  return (
    <View style={[fieldStyles.wrapper, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[fieldStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sm,
    flex: 1,
  },
  input: {
    fontSize: typography.base,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 100,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxxl },
  headerSection: { gap: spacing.xs },
  heroTitle: { fontSize: typography.xxl, fontWeight: '800', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: typography.sm, lineHeight: 20 },
  presetRow: { flexDirection: 'row', gap: spacing.sm },
  presetChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  presetLabel: { fontSize: typography.xs, fontWeight: '700' },
  inputCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '700' },
  emptyBody: { fontSize: typography.sm, textAlign: 'center', lineHeight: 20 },
});
