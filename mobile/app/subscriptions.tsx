import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import axios from "axios";
import {
  fetchEntitlements,
  fetchProfile,
  fetchQuestionnaireProgress,
  fetchSubscriptionPlans,
  postSubscriptionCheckout,
  queryKeys,
  staleTimes,
  type Entitlements,
} from "@garzoni/core";
import GlassButton from "../src/components/ui/GlassButton";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import { getRevenueCatPurchases } from "../src/billing/safeRevenueCat";
import { href } from "../src/navigation/href";
import { useAuthSession } from "../src/auth/AuthContext";

const PRODUCT_TO_PLAN: Record<string, "plus" | "pro"> = {
  "tech.garzoni.app.plus_monthly": "plus",
  "tech.garzoni.app.plus_yearly": "plus",
  "tech.garzoni.app.pro_monthly": "pro",
  "tech.garzoni.app.pro_yearly": "pro",
};

let revenueCatConfiguredGlobal = false;

function configureRevenueCat(userId?: string) {
  const rc = getRevenueCatPurchases();
  if (!rc) return;
  const apiKey = Constants.expoConfig?.extra?.revenueCatApiKeyIos as string | undefined;
  if (!apiKey || revenueCatConfiguredGlobal) return;
  revenueCatConfiguredGlobal = true;
  rc.Purchases.configure({ apiKey, appUserID: userId ?? null });
}

type PlanFeature = {
  name?: string;
  description?: string;
  enabled?: boolean;
  daily_quota?: number | null;
};

type Plan = {
  plan_id: string;
  name?: string;
  billing_interval: string;
  price_amount?: number | string;
  currency?: string;
  trial_days?: number | null;
  sort_order?: number | null;
  features?: Record<string, PlanFeature>;
};

function formatFeatureValue(
  feature: PlanFeature | undefined,
  t: (k: string, o?: Record<string, unknown>) => string
) {
  if (!feature || feature.enabled === false) return t("subscriptions.notIncluded");
  if (feature.daily_quota === null || feature.daily_quota === undefined)
    return t("subscriptions.unlimited");
  if (typeof feature.daily_quota === "number")
    return t("subscriptions.perDay", { count: feature.daily_quota });
  return t("subscriptions.included");
}

function RcPackageRow({
  pkg,
  onPress,
  loading,
  c,
  subscribeLabel,
}: {
  pkg: PurchasesPackage;
  onPress: (pkg: PurchasesPackage) => void;
  loading: boolean;
  c: ReturnType<typeof useThemeColors>;
  subscribeLabel: string;
}) {
  const planKey = PRODUCT_TO_PLAN[pkg.product.identifier] ?? "plus";
  const isYearly = pkg.product.identifier.includes("yearly");
  return (
    <GlassCard padding="md" style={{ marginBottom: spacing.sm }}>
      <View style={styles.pkgRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pkgTitle, { color: c.text }]}>
            {planKey === "pro" ? "Pro" : "Plus"} — {isYearly ? "Yearly" : "Monthly"}
          </Text>
          <Text style={[styles.pkgPrice, { color: c.textMuted }]}>
            {pkg.product.priceString}
            {isYearly ? " / year" : " / month"}
          </Text>
        </View>
        <GlassButton variant="active" size="sm" onPress={() => onPress(pkg)} loading={loading}>
          {subscribeLabel}
        </GlassButton>
      </View>
    </GlassCard>
  );
}

export default function SubscriptionsScreen() {
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const { accessToken } = useAuthSession();
  const queryClient = useQueryClient();
  const revenueCatNative = useMemo(() => getRevenueCatPurchases() !== null, []);

  const [billingInterval, setBillingInterval] = useState<"yearly" | "monthly">("yearly");
  const [selectionError, setSelectionError] = useState("");
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const profileLoaded = useRef(false);

  const profileQ = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
    enabled: Boolean(accessToken),
  });

  const entQ = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data as Entitlements),
    staleTime: staleTimes.entitlements,
    enabled: Boolean(accessToken),
  });

  const questionnaireQ = useQuery({
    queryKey: queryKeys.questionnaireProgress(),
    queryFn: fetchQuestionnaireProgress,
    staleTime: 0,
    enabled: Boolean(accessToken),
  });

  const plansQ = useQuery({
    queryKey: queryKeys.subscriptionPlans(),
    queryFn: () => fetchSubscriptionPlans().then((r) => (r.data?.plans ?? []) as Plan[]),
    staleTime: 5 * 60_000,
  });

  const plans = plansQ.data ?? [];

  useEffect(() => {
    if (profileLoaded.current) return;
    const userId = profileQ.data?.user?.toString();
    if (!revenueCatNative || !profileQ.isFetched) return;
    profileLoaded.current = true;
    configureRevenueCat(userId);
    void (async () => {
      const rc = getRevenueCatPurchases();
      if (!rc) return;
      setLoadingOffering(true);
      try {
        const offerings = await rc.Purchases.getOfferings();
        setOffering(offerings.current);
      } catch (e) {
        if (__DEV__) console.warn("[Subscriptions] getOfferings:", e);
      } finally {
        setLoadingOffering(false);
      }
    })();
  }, [profileQ.isFetched, profileQ.data, revenueCatNative]);

  const questionnaireComplete = questionnaireQ.data?.status === "completed";

  const planRank = (plan?: string | null) => {
    if (plan === "plus") return 1;
    if (plan === "pro") return 2;
    return 0;
  };

  const ent = entQ.data;
  const resolvedPlan =
    (typeof ent?.plan === "string" ? ent.plan : null) ||
    (profileQ.data?.subscription_plan_id as string | undefined) ||
    "starter";
  const hasPaid = planRank(resolvedPlan) >= 1 || Boolean(ent?.entitled);

  const planCards = useMemo(() => {
    const sorted = [...plans].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const starter = sorted.find((p) => p.plan_id === "starter");
    const plus = sorted.find(
      (p) => p.plan_id === "plus" && p.billing_interval === billingInterval
    );
    const pro = sorted.find(
      (p) => p.plan_id === "pro" && p.billing_interval === billingInterval
    );
    const out: Plan[] = [];
    if (starter) out.push(starter);
    if (plus) out.push(plus);
    if (pro) out.push(pro);
    return out;
  }, [plans, billingInterval]);

  const comparisonRows = useMemo(() => {
    if (!plans.length) return [];
    const monthly = plans.filter((p) => p.billing_interval === "monthly");
    const byId = monthly.reduce<Record<string, Plan>>((acc, p) => {
      acc[p.plan_id] = p;
      return acc;
    }, {});
    const keys = new Set<string>();
    Object.values(byId).forEach((p) =>
      Object.keys(p?.features || {}).forEach((k) => keys.add(k))
    );
    return Array.from(keys).map((key) => {
      const s = byId.starter?.features?.[key];
      const pl = byId.plus?.features?.[key];
      const pr = byId.pro?.features?.[key];
      const label = s?.name || pl?.name || pr?.name || key.replace(/_/g, " ");
      return {
        feature: label,
        starter: formatFeatureValue(s, t),
        plus: formatFeatureValue(pl, t),
        pro: formatFeatureValue(pr, t),
      };
    });
  }, [plans, t]);

  const onRcPurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      const rc = getRevenueCatPurchases();
      if (!rc) return;
      setSelectionError("");
      setPurchasingId(pkg.product.identifier);
      try {
        await rc.Purchases.purchasePackage(pkg);
        await queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
        Alert.alert(t("billing.purchaseSuccessTitle"), t("billing.purchaseSuccessBody"));
        router.replace(href("/personalized-path"));
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code !== rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          setSelectionError(t("subscriptions.checkoutFailed"));
        }
      } finally {
        setPurchasingId(null);
      }
    },
    [queryClient, t]
  );

  const handlePlanSelect = useCallback(
    async (plan: Plan | null) => {
      if (!plan) {
        setSelectionError(t("subscriptions.selectPlanError"));
        return;
      }
      if (!accessToken) {
        router.push("/login");
        return;
      }
      setSelectionError("");
      const isStarter =
        plan.plan_id === "starter" || Number(plan.price_amount || 0) === 0;
      if (isStarter) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
        router.replace(href("/(tabs)/index"));
        return;
      }
      if (!questionnaireComplete) {
        setSelectionError(t("subscriptions.completeOnboardingFirst"));
        router.push(href("/onboarding"));
        return;
      }

      if (revenueCatNative && getRevenueCatPurchases()) {
        const pkgs = offering?.availablePackages ?? [];
        if (pkgs.length === 0) {
          setSelectionError(t("subscriptions.paymentNotConfigured"));
          return;
        }
        const wantYearly = plan.billing_interval === "yearly";
        const match =
          pkgs.find((p) => {
            const id = p.product.identifier;
            const isY = id.includes("yearly");
            const tier = PRODUCT_TO_PLAN[id] ?? (id.includes("pro") ? "pro" : "plus");
            return tier === plan.plan_id && isY === wantYearly;
          }) ?? pkgs[0];
        await onRcPurchase(match);
        return;
      }

      setBusyPlanId(plan.plan_id);
      try {
        const r = await postSubscriptionCheckout({
          plan_id: plan.plan_id,
          billing_interval: plan.billing_interval,
        });
        const url = r.data?.redirect_url;
        if (url) {
          const can = await Linking.canOpenURL(url);
          if (can) await Linking.openURL(url);
          else setSelectionError(t("subscriptions.checkoutFailed"));
          return;
        }
        setSelectionError(t("subscriptions.checkoutFailed"));
      } catch (err: unknown) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        const message = axios.isAxiosError(err)
          ? String(err.response?.data?.error ?? err.response?.data?.detail ?? "")
          : "";
        if (status === 503) {
          setSelectionError(message || t("subscriptions.paymentNotConfigured"));
        } else {
          setSelectionError(message || t("subscriptions.checkoutFailed"));
        }
      } finally {
        setBusyPlanId(null);
      }
    },
    [
      accessToken,
      offering?.availablePackages,
      onRcPurchase,
      questionnaireComplete,
      queryClient,
      revenueCatNative,
      t,
    ]
  );

  const formatMoney = (plan: Plan) => {
    const raw = plan.price_amount;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"));
    if (!Number.isFinite(n) || n === 0) return t("subscriptions.free");
    const cur = String(plan.currency || "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: "currency",
        currency: cur,
      }).format(n);
    } catch {
      return `${n} ${cur}`;
    }
  };

  const packages = offering?.availablePackages ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: t("footer.subscriptions"),
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <Text style={[styles.title, { color: c.text }]}>{t("subscriptions.choosePlan")}</Text>
        <Text style={[styles.intro, { color: c.textMuted }]}>{t("subscriptions.intro")}</Text>

        {ent?.fallback ? (
          <Text style={[styles.warn, { color: c.accent }]}>{t("subscriptions.fallbackEntitlements")}</Text>
        ) : null}

        {selectionError ? (
          <Text style={[styles.error, { color: c.error }]}>{selectionError}</Text>
        ) : null}

        {hasPaid ? (
          <GlassCard padding="lg" style={{ marginBottom: spacing.lg }}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {t("subscriptions.subscriptionStatus")}
            </Text>
            <Text style={{ color: c.textMuted, marginBottom: spacing.md }}>
              {t("subscriptions.statusPaid")}
            </Text>
            <GlassButton variant="active" size="md" onPress={() => router.push(href("/billing"))}>
              {t("billing.manageSubscription")}
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="md"
              style={{ marginTop: spacing.sm }}
              onPress={() => router.replace(href("/personalized-path"))}
            >
              {t("subscriptions.viewPersonalizedPath")}
            </GlassButton>
          </GlassCard>
        ) : null}

        {!hasPaid ? (
          <>
            <View style={styles.intervalRow}>
              <GlassButton
                variant={billingInterval === "yearly" ? "active" : "ghost"}
                size="sm"
                onPress={() => setBillingInterval("yearly")}
              >
                {t("subscriptions.billingYearly")}
              </GlassButton>
              <GlassButton
                variant={billingInterval === "monthly" ? "active" : "ghost"}
                size="sm"
                onPress={() => setBillingInterval("monthly")}
              >
                {t("subscriptions.billingMonthly")}
              </GlassButton>
            </View>

            {plansQ.isPending ? (
              <Text style={{ color: c.textMuted }}>{t("subscriptions.loadingPlans")}</Text>
            ) : null}

            {revenueCatNative && packages.length > 0 ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>
                  {t("subscriptions.comparePlans")}
                </Text>
                {packages.map((pkg) => (
                  <RcPackageRow
                    key={pkg.product.identifier}
                    pkg={pkg}
                    onPress={onRcPurchase}
                    loading={purchasingId === pkg.product.identifier}
                    c={c}
                    subscribeLabel={t("subscriptions.choosePlanCheckout", {
                      name: PRODUCT_TO_PLAN[pkg.product.identifier] === "pro" ? "Pro" : "Plus",
                    })}
                  />
                ))}
                <GlassButton
                  variant="ghost"
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                  onPress={() => router.push(href("/billing"))}
                >
                  {t("billing.manageSubscription")}
                </GlassButton>
              </View>
            ) : (
              <View style={{ marginTop: spacing.md }}>
                {revenueCatNative && loadingOffering ? (
                  <Text style={{ color: c.textMuted, marginBottom: spacing.md }}>
                    {t("subscriptions.loadingPlans")}
                  </Text>
                ) : null}
                {planCards.length === 0 && !plansQ.isPending ? (
                  <Text style={{ color: c.textMuted }}>{t("subscriptions.paymentNotConfigured")}</Text>
                ) : null}
                {planCards.map((plan) => {
                  const isStarter =
                    plan.plan_id === "starter" || Number(plan.price_amount || 0) === 0;
                  const label = isStarter
                    ? t("subscriptions.startStarter")
                    : t("subscriptions.choosePlanCheckout", { name: plan.name || plan.plan_id });
                  return (
                    <GlassCard
                      key={`${plan.plan_id}-${plan.billing_interval}`}
                      padding="md"
                      style={{ marginBottom: spacing.sm }}
                    >
                      <Text style={[styles.planName, { color: c.text }]}>
                        {plan.name || plan.plan_id}
                      </Text>
                      <Text style={[styles.pkgPrice, { color: c.textMuted }]}>
                        {formatMoney(plan)} /{" "}
                        {plan.billing_interval === "yearly"
                          ? t("subscriptions.perYear")
                          : t("subscriptions.perMonth")}
                        {plan.trial_days
                          ? ` · ${t("subscriptions.trialDays", { count: plan.trial_days })}`
                          : ""}
                      </Text>
                      <GlassButton
                        variant="active"
                        size="sm"
                        style={{ marginTop: spacing.sm }}
                        loading={busyPlanId === plan.plan_id}
                        onPress={() => void handlePlanSelect(plan)}
                      >
                        {label}
                      </GlassButton>
                    </GlassCard>
                  );
                })}
              </View>
            )}

            {comparisonRows.length > 0 && !revenueCatNative && packages.length === 0 ? (
              <View style={{ marginTop: spacing.xl }}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>
                  {t("subscriptions.seeWhatChanges")}
                </Text>
                <View style={[styles.compHeaderRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.compColFeature, { color: c.textMuted }]}>
                    {t("subscriptions.feature")}
                  </Text>
                  <Text style={[styles.compCol, { color: c.textMuted }]}>
                    {t("subscriptions.starter")}
                  </Text>
                  <Text style={[styles.compCol, { color: c.textMuted }]}>{t("subscriptions.plus")}</Text>
                  <Text style={[styles.compCol, { color: c.textMuted }]}>{t("subscriptions.pro")}</Text>
                </View>
                {comparisonRows.slice(0, 12).map((row) => (
                  <View
                    key={row.feature}
                    style={[styles.compHeaderRow, { borderBottomColor: c.border }]}
                  >
                    <Text style={[styles.compColFeature, { color: c.text }]} numberOfLines={3}>
                      {row.feature}
                    </Text>
                    <Text style={[styles.compCol, { color: c.textMuted, fontSize: typography.xs }]}>
                      {row.starter}
                    </Text>
                    <Text style={[styles.compCol, { color: c.textMuted, fontSize: typography.xs }]}>
                      {row.plus}
                    </Text>
                    <Text style={[styles.compCol, { color: c.textMuted, fontSize: typography.xs }]}>
                      {row.pro}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={[styles.legal, { color: c.textFaint }]}>
          {Platform.OS === "ios" && revenueCatNative
            ? t("billing.subscriptionsLegalIos")
            : t("subscriptions.intro")}
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 48 },
  title: { fontSize: typography.xl, fontWeight: "800", marginBottom: spacing.sm },
  intro: { fontSize: typography.sm, lineHeight: 20, marginBottom: spacing.lg },
  warn: { fontSize: typography.sm, marginBottom: spacing.md },
  error: { fontSize: typography.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.base, fontWeight: "700", marginBottom: spacing.md },
  intervalRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  pkgRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pkgTitle: { fontSize: typography.sm, fontWeight: "600", marginBottom: 2 },
  pkgPrice: { fontSize: typography.xs },
  planName: { fontSize: typography.md, fontWeight: "700" },
  compHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  compColFeature: { flex: 2.2, fontSize: typography.xs, fontWeight: "600" },
  compCol: { flex: 1, fontSize: typography.xs, textAlign: "center" },
  legal: { fontSize: typography.xs, lineHeight: 16, marginTop: spacing.xl, textAlign: "center" },
});
