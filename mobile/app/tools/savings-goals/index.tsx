import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { radius, shadows, spacing, typography } from "../../../src/theme/tokens";
import {
  calcSavings,
  type SavingsForm,
} from "../../../src/types/savings-calculator";
import { ResultSummary } from "../../../src/components/tools/savings-calculator/ResultSummary";
import { GrowthChart } from "../../../src/components/tools/savings-calculator/GrowthChart";

const PRESETS: Array<{ label: string; form: Partial<SavingsForm> }> = [
  {
    label: "Emergency fund",
    form: {
      savingsGoal: "10000",
      initialAmount: "500",
      monthlyContribution: "250",
      annualRate: "4",
      years: "3",
    },
  },
  {
    label: "House deposit",
    form: {
      savingsGoal: "40000",
      initialAmount: "5000",
      monthlyContribution: "600",
      annualRate: "5",
      years: "5",
    },
  },
  {
    label: "Retirement boost",
    form: {
      savingsGoal: "250000",
      initialAmount: "10000",
      monthlyContribution: "400",
      annualRate: "7",
      years: "20",
    },
  },
];

const DEFAULT_FORM: SavingsForm = {
  savingsGoal: "10000",
  initialAmount: "1000",
  monthlyContribution: "200",
  annualRate: "5",
  years: "5",
};

export default function SavingsGoalsScreen() {
  const c = useThemeColors();
  const [form, setForm] = useState<SavingsForm>(DEFAULT_FORM);

  const result = useMemo(() => calcSavings(form), [form]);
  const goalAmount = Number(form.savingsGoal || 0);

  const set = (k: keyof SavingsForm) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v.replace(/[^0-9.]/g, "") }));

  const applyPreset = (preset: Partial<SavingsForm>) =>
    setForm((f) => ({ ...f, ...preset }));

  return (
    <>
      <Stack.Screen options={{ title: "Savings Goals" }} />
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: c.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.intro, { color: c.textMuted }]}>
            Project how your savings grow with compound interest. Adjust the
            inputs or start from a preset.
          </Text>

          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => applyPreset(p.form)}
                style={[
                  styles.preset,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <Text style={[styles.presetText, { color: c.text }]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: c.surface, borderColor: c.border },
              shadows.sm,
            ]}
          >
            <Field
              label="Savings goal ($)"
              value={form.savingsGoal}
              onChange={set("savingsGoal")}
              c={c}
            />
            <Field
              label="Initial amount ($)"
              value={form.initialAmount}
              onChange={set("initialAmount")}
              c={c}
            />
            <Field
              label="Monthly contribution ($)"
              value={form.monthlyContribution}
              onChange={set("monthlyContribution")}
              c={c}
            />
            <Field
              label="Annual interest rate (%)"
              value={form.annualRate}
              onChange={set("annualRate")}
              c={c}
            />
            <Field
              label="Time horizon (years)"
              value={form.years}
              onChange={set("years")}
              c={c}
            />
          </View>

          {result ? (
            <>
              <ResultSummary result={result} goalAmount={goalAmount} />
              <GrowthChart data={result.chartData} goalAmount={goalAmount} />
            </>
          ) : (
            <View
              style={[
                styles.card,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[styles.hint, { color: c.textMuted }]}>
                Enter a time horizon greater than 0 to see your projection.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  c,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        inputMode="decimal"
        style={[
          styles.input,
          {
            borderColor: c.border,
            backgroundColor: c.inputBg,
            color: c.text,
          },
        ]}
        placeholderTextColor={c.textFaint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
    gap: spacing.lg,
  },
  intro: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  preset: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  presetText: { fontSize: typography.sm, fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: { gap: spacing.xs },
  label: {
    fontSize: typography.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.base,
  },
  hint: { fontSize: typography.sm, textAlign: "center" },
});
