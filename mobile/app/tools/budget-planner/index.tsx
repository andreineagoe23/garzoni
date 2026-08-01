import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  apiClient,
  fetchEntitlements,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { layout, radius, spacing, typography } from "../../../src/theme/tokens";
import { useScreenGutter } from "../../../src/utils/platform";
import { href } from "../../../src/navigation/href";
import { logDevError } from "../../../src/lib/logDevError";
import { trackGarzoniEvent } from "../../../src/bootstrap/customerIoMobile";
import { useCfoProfile } from "../../../src/state/cfoProfile";
import WhyThisMattersMobile from "../../../src/components/tools/WhyThisMattersMobile";

type Envelope = {
  id: number;
  category: string;
  label: string;
  monthly_target: number;
  spent_this_period: number;
  currency: string;
};

type SpendingSummary = {
  period: string;
  total_income: number;
  total_spent: number;
  net_cash_flow: number;
  currency: string;
};

const CATEGORIES = [
  "housing",
  "groceries",
  "transport",
  "utilities",
  "entertainment",
  "savings",
  "other",
];

export default function BudgetPlannerScreen() {
  const c = useThemeColors();
  const gutter = useScreenGutter();
  const router = useRouter();
  const { t } = useTranslation("common");
  const { profile, setProfile } = useCfoProfile();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("groceries");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [creating, setCreating] = useState(false);

  const profileIncomeMid =
    (Number(profile.incomeLow || 0) + Number(profile.incomeHigh || 0)) / 2;
  const profileExpenseMid =
    (Number(profile.expenseLow || 0) + Number(profile.expenseHigh || 0)) / 2;
  const hasProfileRanges = profileIncomeMid > 0 || profileExpenseMid > 0;

  const entQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data),
    staleTime: staleTimes.entitlements,
  });
  const hasPlus = ["plus", "pro"].includes(entQuery.data?.plan ?? "");

  useEffect(() => {
    if (entQuery.isFetched && !hasPlus) {
      router.replace(href("/(tabs)/tools"));
    }
  }, [entQuery.isFetched, hasPlus, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [envRes, sumRes] = await Promise.allSettled([
        (apiClient as any).get("/budgeting/envelopes/"),
        (apiClient as any).get("/budgeting/spending-summary/"),
      ]);
      if (envRes.status === "fulfilled") {
        setEnvelopes(envRes.value.data?.results ?? envRes.value.data ?? []);
      }
      if (sumRes.status === "fulfilled") {
        setSummary(sumRes.value.data ?? null);
      }
      if (
        envRes.status === "rejected" &&
        envRes.reason?.response?.status === 402
      ) {
        setError(t("tools.budgetPlanner.errors.notEntitled"));
      }
    } catch (e) {
      logDevError("tools/budget-planner/load", e);
      setError(t("tools.budgetPlanner.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (entQuery.isFetched && hasPlus) void load();
  }, [entQuery.isFetched, hasPlus, load]);

  useEffect(() => {
    if (!summary) return;
    const net = summary.net_cash_flow;
    if (
      profile.monthlyNetCashFlow !== undefined &&
      Math.abs(profile.monthlyNetCashFlow - net) < 1
    ) {
      return;
    }
    setProfile({ monthlyNetCashFlow: net });
  }, [summary, profile.monthlyNetCashFlow, setProfile]);

  const handleCreate = async () => {
    if (!label || !target) return;
    setCreating(true);
    try {
      await (apiClient as any).post("/budgeting/envelopes/", {
        category,
        label,
        monthly_target: Number(target),
      });
      setLabel("");
      setTarget("");
      await load();
      void trackGarzoniEvent("budget_envelope_created", {
        category,
        surface: "mobile",
      });
    } catch (e) {
      logDevError("tools/budget-planner/create", e);
      setError(t("tools.budgetPlanner.errors.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const currency = summary?.currency || envelopes[0]?.currency || "USD";
  const overBudgetEnvelopes = useMemo(
    () => envelopes.filter((e) => e.spent_this_period > e.monthly_target),
    [envelopes],
  );

  return (
    <>
      <Stack.Screen options={{ title: "Budget & Spending" }} />
      <ScrollView
        style={[styles.root, { backgroundColor: c.bg }]}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.screenPaddingX + gutter },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <WhyThisMattersMobile toolSlug="budget-planner" />
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: c.textMuted }]}>
            {t("tools.budgetPlanner.eyebrow").toUpperCase()}
          </Text>
          <Text style={[styles.title, { color: c.text }]}>
            {t("tools.budgetPlanner.title")}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {t("tools.budgetPlanner.subtitle")}
          </Text>
        </View>

        {hasProfileRanges && (
          <View
            style={[
              styles.profileCard,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <View style={styles.profileTextBlock}>
              <Text style={[styles.profileTitle, { color: c.textMuted }]}>
                From your Reality Check
              </Text>
              <Text style={[styles.profileBody, { color: c.text }]}>
                Income ~{Math.round(profileIncomeMid)} {currency} · Expenses ~
                {Math.round(profileExpenseMid)} {currency}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(href("/(tabs)/tools/reality-check"))}
              style={({ pressed }) => [
                styles.profileLink,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.profileLinkText, { color: c.primary }]}>
                Update your goal →
              </Text>
            </Pressable>
          </View>
        )}

        {error && (
          <View
            style={[
              styles.card,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Text style={{ color: c.textMuted, fontSize: typography.sm }}>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.totalsRow}>
          <View
            style={[
              styles.totalCard,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Text style={[styles.totalLabel, { color: c.textMuted }]}>
              {t("tools.budgetPlanner.totals.income")}
            </Text>
            <Text style={[styles.totalValue, { color: c.text }]}>
              {loading
                ? "—"
                : `${(summary?.total_income ?? 0).toFixed(0)} ${currency}`}
            </Text>
          </View>
          <View
            style={[
              styles.totalCard,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Text style={[styles.totalLabel, { color: c.textMuted }]}>
              {t("tools.budgetPlanner.totals.spent")}
            </Text>
            <Text style={[styles.totalValue, { color: c.text }]}>
              {loading
                ? "—"
                : `${(summary?.total_spent ?? 0).toFixed(0)} ${currency}`}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {t("tools.budgetPlanner.totals.netFlow")}
          </Text>
          <Text
            style={[
              styles.netFlow,
              {
                color:
                  (summary?.net_cash_flow ?? 0) >= 0 ? c.primary : "#dc2626",
              },
            ]}
          >
            {loading
              ? "—"
              : `${(summary?.net_cash_flow ?? 0).toFixed(0)} ${currency}`}
          </Text>
          {overBudgetEnvelopes.length > 0 && (
            <Text style={[styles.overBudget, { color: "#b45309" }]}>
              {t("tools.budgetPlanner.totals.overBudgetCount", {
                count: overBudgetEnvelopes.length,
              })}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.card,
            { borderColor: c.border, backgroundColor: c.surface },
          ]}
        >
          <Text style={[styles.cardTitle, { color: c.text }]}>
            {t("tools.budgetPlanner.envelopes.title")}
          </Text>
          <Text style={[styles.cardSubtitle, { color: c.textMuted }]}>
            {t("tools.budgetPlanner.envelopes.subtitle")}
          </Text>

          {envelopes.length === 0 && !loading && (
            <Text style={[styles.empty, { color: c.textMuted }]}>
              {t("tools.budgetPlanner.envelopes.empty")}
            </Text>
          )}

          {envelopes.map((env) => {
            const ratio =
              env.monthly_target > 0
                ? Math.min(env.spent_this_period / env.monthly_target, 2)
                : 0;
            const percent = Math.round(ratio * 100);
            const over = env.spent_this_period > env.monthly_target;
            return (
              <View key={env.id} style={styles.envRow}>
                <View style={styles.envRowTop}>
                  <Text
                    style={[styles.envLabel, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {env.label}
                  </Text>
                  <Text
                    style={[
                      styles.envMeta,
                      { color: over ? "#dc2626" : c.textMuted },
                    ]}
                  >
                    {env.spent_this_period.toFixed(0)} /{" "}
                    {env.monthly_target.toFixed(0)} {env.currency}
                  </Text>
                </View>
                <View style={[styles.envTrack, { backgroundColor: c.border }]}>
                  <View
                    style={[
                      styles.envFill,
                      {
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: over ? "#dc2626" : c.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}

          <View style={styles.createBlock}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs }}
            >
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.catChip,
                    {
                      borderColor: c.border,
                      backgroundColor:
                        category === cat ? c.primary + "22" : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color: category === cat ? c.primary : c.textMuted,
                      },
                    ]}
                  >
                    {t(`tools.budgetPlanner.categories.${cat}`, cat)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              placeholder={t("tools.budgetPlanner.envelopes.labelPlaceholder")}
              placeholderTextColor={c.textMuted}
              value={label}
              onChangeText={setLabel}
              style={[styles.input, { borderColor: c.border, color: c.text }]}
            />
            <TextInput
              placeholder={t("tools.budgetPlanner.envelopes.targetPlaceholder")}
              placeholderTextColor={c.textMuted}
              value={target}
              onChangeText={(v) => setTarget(v.replace(/[^0-9.]/g, ""))}
              keyboardType="numeric"
              style={[styles.input, { borderColor: c.border, color: c.text }]}
            />
            <Pressable
              onPress={handleCreate}
              disabled={creating}
              style={({ pressed }) => [
                styles.addBtn,
                {
                  backgroundColor: c.primary,
                  opacity: creating ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.addBtnText}>
                {creating
                  ? t("tools.budgetPlanner.envelopes.adding")
                  : t("tools.budgetPlanner.envelopes.add")}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
    gap: spacing.lg,
  },
  header: { gap: spacing.xs },
  eyebrow: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: { fontSize: typography.xxl, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sm, lineHeight: 20 },
  profileCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  profileTextBlock: { flex: 1, gap: 2 },
  profileTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  profileBody: { fontSize: typography.sm, fontWeight: "600" },
  profileLink: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  profileLinkText: { fontSize: typography.xs, fontWeight: "700" },
  totalsRow: { flexDirection: "row", gap: spacing.md },
  totalCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  totalLabel: { fontSize: typography.xs, fontWeight: "700" },
  totalValue: { fontSize: typography.xl, fontWeight: "800" },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: typography.md, fontWeight: "700" },
  cardSubtitle: { fontSize: typography.xs },
  netFlow: { fontSize: typography.xl, fontWeight: "800" },
  overBudget: { fontSize: typography.xs },
  empty: { fontSize: typography.sm, fontStyle: "italic" },
  envRow: { gap: spacing.xs, marginTop: spacing.sm },
  envRowTop: { flexDirection: "row", justifyContent: "space-between" },
  envLabel: { fontSize: typography.sm, fontWeight: "600", flex: 1 },
  envMeta: { fontSize: typography.xs },
  envTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  envFill: { height: 6, borderRadius: 3 },
  createBlock: { marginTop: spacing.md, gap: spacing.sm },
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  catChipText: { fontSize: typography.xs, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sm,
  },
  addBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: typography.sm,
  },
});
