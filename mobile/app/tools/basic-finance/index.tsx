import React, { useMemo, useState } from 'react';
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
import { spacing, typography, radius } from '../../../src/theme/tokens';
import { CalculatorAccordion } from '../../../src/components/tools/basic-finance/CalculatorAccordion';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function InputRow({
  label,
  value,
  onChange,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={inputStyles.row}>
      <Text style={[inputStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[inputStyles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
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

const inputStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  label: { flex: 1, fontSize: typography.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 100,
  },
});

function ResultRow({ label, value, colors, highlight }: { label: string; value: string; colors: ReturnType<typeof useThemeColors>; highlight?: boolean }) {
  return (
    <View style={resStyles.row}>
      <Text style={[resStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[resStyles.value, { color: highlight ? colors.primary : colors.text }]}>{value}</Text>
    </View>
  );
}

const resStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: typography.sm },
  value: { fontSize: typography.base, fontWeight: '700' },
});

function PresetRow({ presets, colors, onApply }: { presets: { label: string; values: Record<string, string> }[]; colors: ReturnType<typeof useThemeColors>; onApply: (v: Record<string, string>) => void }) {
  return (
    <View style={preStyles.row}>
      {presets.map((p) => (
        <Pressable
          key={p.label}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onApply(p.values);
          }}
          style={[preStyles.chip, { backgroundColor: colors.surfaceOffset, borderColor: colors.border }]}
        >
          <Text style={[preStyles.label, { color: colors.textMuted }]}>{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const preStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1 },
  label: { fontSize: typography.xs, fontWeight: '700' },
});

function Divider({ color }: { color: string }) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: spacing.xs }} />;
}

// ─── Compound Interest Calculator ────────────────────────────────────────────

function CompoundInterestCalc() {
  const c = useThemeColors();
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [years, setYears] = useState('');
  const [freq, setFreq] = useState('12');

  const result = useMemo(() => {
    const P = Number(principal || 0);
    const r = Number(rate || 0) / 100;
    const n = Number(freq || 12);
    const t = Number(years || 0);
    if (!P || !r || !t) return null;
    const fv = P * Math.pow(1 + r / n, n * t);
    return { fv, interest: fv - P };
  }, [principal, rate, years, freq]);

  return (
    <View style={{ gap: spacing.md }}>
      <PresetRow
        colors={c}
        presets={[
          { label: '$10k @ 7% / 10yr', values: { principal: '10000', rate: '7', years: '10', freq: '12' } },
          { label: '$1k @ 5% / 5yr', values: { principal: '1000', rate: '5', years: '5', freq: '12' } },
        ]}
        onApply={(v) => { setPrincipal(v.principal); setRate(v.rate); setYears(v.years); setFreq(v.freq); }}
      />
      <InputRow label="Principal ($)" value={principal} onChange={setPrincipal} placeholder="10000" colors={c} />
      <InputRow label="Annual Rate (%)" value={rate} onChange={setRate} placeholder="7" colors={c} />
      <InputRow label="Years" value={years} onChange={setYears} placeholder="10" colors={c} />
      <InputRow label="Compounds/year" value={freq} onChange={setFreq} placeholder="12" colors={c} />
      {result && (
        <>
          <Divider color={c.border} />
          <ResultRow label="Future Value" value={fmtCurrency(result.fv)} colors={c} highlight />
          <ResultRow label="Interest Earned" value={fmtCurrency(result.interest)} colors={c} />
        </>
      )}
    </View>
  );
}

// ─── Loan Payment Calculator ──────────────────────────────────────────────────

function LoanPaymentCalc() {
  const c = useThemeColors();
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [months, setMonths] = useState('');

  const result = useMemo(() => {
    const P = Number(amount || 0);
    const r = Number(rate || 0) / 100 / 12;
    const n = Number(months || 0);
    if (!P || !n) return null;
    const pmt = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return { pmt, total: pmt * n, interest: pmt * n - P };
  }, [amount, rate, months]);

  return (
    <View style={{ gap: spacing.md }}>
      <PresetRow
        colors={c}
        presets={[
          { label: '$20k car / 60mo', values: { amount: '20000', rate: '6', months: '60' } },
          { label: '$200k home / 360mo', values: { amount: '200000', rate: '4.5', months: '360' } },
        ]}
        onApply={(v) => { setAmount(v.amount); setRate(v.rate); setMonths(v.months); }}
      />
      <InputRow label="Loan Amount ($)" value={amount} onChange={setAmount} placeholder="20000" colors={c} />
      <InputRow label="Annual Rate (%)" value={rate} onChange={setRate} placeholder="6" colors={c} />
      <InputRow label="Term (months)" value={months} onChange={setMonths} placeholder="60" colors={c} />
      {result && (
        <>
          <Divider color={c.border} />
          <ResultRow label="Monthly Payment" value={fmtCurrency(result.pmt)} colors={c} highlight />
          <ResultRow label="Total Paid" value={fmtCurrency(result.total)} colors={c} />
          <ResultRow label="Total Interest" value={fmtCurrency(result.interest)} colors={c} />
        </>
      )}
    </View>
  );
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────

function ROICalc() {
  const c = useThemeColors();
  const [invested, setInvested] = useState('');
  const [returned, setReturned] = useState('');

  const result = useMemo(() => {
    const inv = Number(invested || 0);
    const ret = Number(returned || 0);
    if (!inv) return null;
    const roi = ((ret - inv) / inv) * 100;
    return { roi, profit: ret - inv };
  }, [invested, returned]);

  return (
    <View style={{ gap: spacing.md }}>
      <PresetRow
        colors={c}
        presets={[
          { label: '$5k → $7k', values: { invested: '5000', returned: '7000' } },
          { label: '$10k → $13k', values: { invested: '10000', returned: '13000' } },
        ]}
        onApply={(v) => { setInvested(v.invested); setReturned(v.returned); }}
      />
      <InputRow label="Amount Invested ($)" value={invested} onChange={setInvested} placeholder="5000" colors={c} />
      <InputRow label="Amount Returned ($)" value={returned} onChange={setReturned} placeholder="7000" colors={c} />
      {result && (
        <>
          <Divider color={c.border} />
          <ResultRow
            label="ROI"
            value={`${result.roi >= 0 ? '+' : ''}${fmt(result.roi)}%`}
            colors={c}
            highlight
          />
          <ResultRow
            label="Profit / Loss"
            value={`${result.profit >= 0 ? '+' : ''}${fmtCurrency(result.profit)}`}
            colors={c}
          />
        </>
      )}
    </View>
  );
}

// ─── Budget Calculator ────────────────────────────────────────────────────────

function BudgetCalc() {
  const c = useThemeColors();
  const [income, setIncome] = useState('');
  const [needs, setNeeds] = useState('');
  const [wants, setWants] = useState('');
  const [savings, setSavings] = useState('');

  const result = useMemo(() => {
    const inc = Number(income || 0);
    const n = Number(needs || 0);
    const w = Number(wants || 0);
    const s = Number(savings || 0);
    if (!inc) return null;
    const total = n + w + s;
    const leftover = inc - total;
    const needsPct = (n / inc) * 100;
    const wantsPct = (w / inc) * 100;
    const savingsPct = (s / inc) * 100;
    return { leftover, needsPct, wantsPct, savingsPct, totalSpent: total };
  }, [income, needs, wants, savings]);

  return (
    <View style={{ gap: spacing.md }}>
      <PresetRow
        colors={c}
        presets={[
          { label: '50/30/20 rule', values: { income: '3000', needs: '1500', wants: '900', savings: '600' } },
        ]}
        onApply={(v) => { setIncome(v.income); setNeeds(v.needs); setWants(v.wants); setSavings(v.savings); }}
      />
      <InputRow label="Monthly Income ($)" value={income} onChange={setIncome} placeholder="3000" colors={c} />
      <InputRow label="Needs ($)" value={needs} onChange={setNeeds} placeholder="1500" colors={c} />
      <InputRow label="Wants ($)" value={wants} onChange={setWants} placeholder="900" colors={c} />
      <InputRow label="Savings ($)" value={savings} onChange={setSavings} placeholder="600" colors={c} />
      {result && (
        <>
          <Divider color={c.border} />
          <ResultRow label="Needs %" value={`${fmt(result.needsPct, 1)}%`} colors={c} />
          <ResultRow label="Wants %" value={`${fmt(result.wantsPct, 1)}%`} colors={c} />
          <ResultRow label="Savings %" value={`${fmt(result.savingsPct, 1)}%`} colors={c} />
          <ResultRow
            label="Leftover"
            value={`${result.leftover >= 0 ? '+' : ''}${fmtCurrency(result.leftover)}`}
            colors={c}
            highlight
          />
        </>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BasicFinanceScreen() {
  const c = useThemeColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Basic Finance Tools' }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <Text style={[styles.heroTitle, { color: c.text }]}>Basic Finance</Text>
          <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
            Essential calculators — no account needed
          </Text>
        </View>

        <CalculatorAccordion title="Compound Interest" icon="📈" defaultOpen>
          <CompoundInterestCalc />
        </CalculatorAccordion>

        <CalculatorAccordion title="Loan Payment" icon="🏦">
          <LoanPaymentCalc />
        </CalculatorAccordion>

        <CalculatorAccordion title="Return on Investment" icon="💹">
          <ROICalc />
        </CalculatorAccordion>

        <CalculatorAccordion title="Budget Planner" icon="📊">
          <BudgetCalc />
        </CalculatorAccordion>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxxl },
  headerSection: { gap: spacing.xs },
  heroTitle: { fontSize: typography.xxl, fontWeight: '800', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: typography.sm, lineHeight: 20 },
});
