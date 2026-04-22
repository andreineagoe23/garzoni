import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { brand } from "../src/theme/brand";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import {
  fetchEntitlements,
  fetchProfile,
  fetchQuestionnaireProgress,
  fetchSubscriptionPlans,
  patchUserProfile,
  queryKeys,
  staleTimes,
  type Entitlements,
} from "@garzoni/core";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GlassButton from "../src/components/ui/GlassButton";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { radius, spacing, typography } from "../src/theme/tokens";
import { getRevenueCatPurchases } from "../src/billing/safeRevenueCat";
import GarzoniRevenueCatPaywall from "../src/components/billing/GarzoniRevenueCatPaywall";
import {
  configureRevenueCatForUser,
  fetchRevenueCatPaywallOffering,
  planFromStoreProductIdentifier,
  RC_OFFERING_PRO,
  waitForActiveSubscription,
} from "../src/billing/subscriptionRuntime";
import { href } from "../src/navigation/href";
import { useAuthSession } from "../src/auth/AuthContext";
import { setPlanChosenCache } from "../src/auth/firstRunFlags";

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

const LUX = {
  goldWarm: brand.goldWarm,
  gold: brand.gold,
  primaryBright: "#2a7347",
  faint: "rgba(229,231,235,0.4)",
  ghost: "rgba(229,231,235,0.12)",
};

type GlowProps = {
  width: number;
  height: number;
  color: string;
  opacity?: number;
  stopFar?: number;
  shape?: "circle" | "ellipse";
};
function SubGlow({
  width,
  height,
  color,
  opacity = 1,
  stopFar = 0.65,
  shape = "ellipse",
}: GlowProps) {
  const id = `subg-${Math.round(width)}-${Math.round(height)}-${color.length}`;
  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
          <Stop
            offset={`${stopFar * 100}%`}
            stopColor={color}
            stopOpacity={0}
          />
        </RadialGradient>
      </Defs>
      {shape === "circle" ? (
        <Circle
          cx={width / 2}
          cy={height / 2}
          r={Math.min(width, height) / 2}
          fill={`url(#${id})`}
        />
      ) : (
        <Ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={`url(#${id})`}
        />
      )}
    </Svg>
  );
}

function formatFeatureValue(
  feature: PlanFeature | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
) {
  if (!feature || feature.enabled === false)
    return t("subscriptions.notIncluded");
  if (feature.daily_quota === null || feature.daily_quota === undefined)
    return t("subscriptions.unlimited");
  if (typeof feature.daily_quota === "number")
    return t("subscriptions.perDay", { count: feature.daily_quota });
  return t("subscriptions.included");
}

export default function SubscriptionsScreen() {
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const { accessToken } = useAuthSession();
  const params = useLocalSearchParams<{
    onboarding?: string | string[];
    reason?: string | string[];
    plan?: string | string[];
  }>();
  const onboardingParam = Array.isArray(params.onboarding)
    ? params.onboarding[0]
    : params.onboarding;
  const reasonParam = Array.isArray(params.reason)
    ? params.reason[0]
    : params.reason;
  const onboardingMode = String(onboardingParam ?? "").toLowerCase() === "true";
  const personalizedPathReason =
    String(reasonParam ?? "").toLowerCase() === "personalized_path";
  const planParam = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const initialStorefrontTier = useMemo<"plus" | "pro">(
    () => (String(planParam ?? "").toLowerCase() === "pro" ? "pro" : "plus"),
    [planParam],
  );
  const [storefrontTier, setStorefrontTier] = useState<"plus" | "pro">(
    initialStorefrontTier,
  );
  const queryClient = useQueryClient();
  const revenueCatNative = useMemo(() => getRevenueCatPurchases() !== null, []);

  const [billingInterval, setBillingInterval] = useState<"yearly" | "monthly">(
    "yearly",
  );
  const [selectionError, setSelectionError] = useState("");
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(
    getRevenueCatPurchases() !== null,
  );
  const [offeringLoadFailed, setOfferingLoadFailed] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [activatingPurchase, setActivatingPurchase] = useState(false);
  const lastPaywallTierRef = useRef<"plus" | "pro">("plus");
  const lastUrlSyncedTierRef = useRef<"plus" | "pro" | null>(null);

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
    queryFn: () =>
      fetchSubscriptionPlans().then((r) => (r.data?.plans ?? []) as Plan[]),
    staleTime: 5 * 60_000,
  });

  const plans = plansQ.data ?? [];

  const loadRevenueCatOffering = useCallback(
    async (tier?: "plus" | "pro") => {
      if (!getRevenueCatPurchases()) return null;
      const userId = profileQ.data?.user?.toString();
      if (!configureRevenueCatForUser(userId)) {
        setOfferingLoadFailed(true);
        return null;
      }
      const resolved = tier ?? lastPaywallTierRef.current;
      lastPaywallTierRef.current = resolved;
      setLoadingOffering(true);
      setOfferingLoadFailed(false);
      try {
        const next = await fetchRevenueCatPaywallOffering(
          resolved === "pro" ? { offeringId: RC_OFFERING_PRO } : undefined,
        );
        setOffering(next);
        return next;
      } catch (e) {
        setOfferingLoadFailed(true);
        if (__DEV__) console.warn("[Subscriptions] getOfferings:", e);
        return null;
      } finally {
        setLoadingOffering(false);
      }
    },
    [profileQ.data?.user],
  );

  useEffect(() => {
    if (!revenueCatNative || !profileQ.isFetched) return;
    if (
      lastUrlSyncedTierRef.current === initialStorefrontTier &&
      lastUrlSyncedTierRef.current !== null
    ) {
      return;
    }
    lastUrlSyncedTierRef.current = initialStorefrontTier;
    lastPaywallTierRef.current = initialStorefrontTier;
    setStorefrontTier(initialStorefrontTier);
    void loadRevenueCatOffering(initialStorefrontTier);
  }, [
    initialStorefrontTier,
    loadRevenueCatOffering,
    profileQ.isFetched,
    revenueCatNative,
  ]);

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
    const sorted = [...plans].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const starter = sorted.find((p) => p.plan_id === "starter");
    const plus = sorted.find(
      (p) => p.plan_id === "plus" && p.billing_interval === billingInterval,
    );
    const pro = sorted.find(
      (p) => p.plan_id === "pro" && p.billing_interval === billingInterval,
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
      Object.keys(p?.features || {}).forEach((k) => keys.add(k)),
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

  const persistPlanChoice = useCallback(
    async (planId: string) => {
      if (planId !== "starter" && planId !== "plus" && planId !== "pro") return;
      try {
        await patchUserProfile({ subscription_plan_id: planId });
        await setPlanChosenCache();
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch {
        /* best-effort */
      }
    },
    [queryClient],
  );

  const onRcPurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      const rc = getRevenueCatPurchases();
      if (!rc) return;
      setSelectionError("");
      setPurchasingId(pkg.product.identifier);
      try {
        await rc.Purchases.purchasePackage(pkg);
        const mapped = planFromStoreProductIdentifier(pkg.product.identifier);
        await persistPlanChoice(mapped);
        setActivatingPurchase(true);
        const activated = await waitForActiveSubscription(queryClient);
        Alert.alert(
          t("billing.purchaseSuccessTitle"),
          activated
            ? t("billing.purchaseSuccessBody")
            : t("subscriptions.activationDelayed"),
        );
        router.replace(href(onboardingMode ? "/(tabs)" : "/personalized-path"));
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code !== rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          setSelectionError(t("subscriptions.checkoutFailed"));
        }
      } finally {
        setActivatingPurchase(false);
        setPurchasingId(null);
      }
    },
    [onboardingMode, persistPlanChoice, queryClient, t],
  );

  const onManageStore = useCallback(async () => {
    setSelectionError("");
    const rc = getRevenueCatPurchases();
    const showManageSubscriptions = (
      rc?.Purchases as {
        showManageSubscriptions?: () => Promise<void>;
      } | null
    )?.showManageSubscriptions;
    try {
      if (showManageSubscriptions) {
        await showManageSubscriptions();
        return;
      }
      const url =
        Platform.OS === "ios"
          ? "https://apps.apple.com/account/subscriptions"
          : "https://play.google.com/store/account/subscriptions";
      await Linking.openURL(url);
    } catch {
      setSelectionError(t("billing.failedPortal"));
    }
  }, [t]);

  const onRestoreRc = useCallback(async () => {
    const rc = getRevenueCatPurchases();
    if (!rc) return;
    setSelectionError("");
    try {
      await rc.Purchases.restorePurchases();
      await waitForActiveSubscription(queryClient, {
        maxAttempts: 3,
        delayMs: 1000,
      });
      Alert.alert(
        t("billing.restoreSuccessTitle"),
        t("billing.restoreSuccessBody"),
      );
    } catch {
      setSelectionError(t("billing.restoreFailed"));
    }
  }, [queryClient, t]);

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
        await persistPlanChoice("starter");
        await queryClient.invalidateQueries({
          queryKey: queryKeys.entitlements(),
        });
        router.replace(href(onboardingMode ? "/(tabs)" : "/(tabs)/index"));
        return;
      }
      if (!questionnaireComplete) {
        setSelectionError(t("subscriptions.completeOnboardingFirst"));
        router.push(href("/onboarding?reason=personalized_path"));
        return;
      }

      if (!revenueCatNative || !getRevenueCatPurchases()) {
        setSelectionError(t("subscriptions.rcRequiredBody"));
        return;
      }

      const tier = plan.plan_id === "pro" ? "pro" : "plus";
      const tierOffering = (await loadRevenueCatOffering(tier)) ?? offering;
      const pkgs = tierOffering?.availablePackages ?? [];
      if (pkgs.length === 0) {
        setSelectionError(t("subscriptions.paymentNotConfigured"));
        return;
      }

      await persistPlanChoice(plan.plan_id);
      const wantYearly = plan.billing_interval === "yearly";
      const match =
        pkgs.find((p) => {
          const id = p.product.identifier;
          const isY = id.includes("yearly");
          const tier = planFromStoreProductIdentifier(id);
          return tier === plan.plan_id && isY === wantYearly;
        }) ?? pkgs[0];
      await onRcPurchase(match);
    },
    [
      accessToken,
      loadRevenueCatOffering,
      offering,
      onRcPurchase,
      persistPlanChoice,
      questionnaireComplete,
      revenueCatNative,
      t,
    ],
  );

  useEffect(() => {
    if (!onboardingMode) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [onboardingMode]);

  const findPackageForPlan = (plan: Plan) => {
    const pkgs = offering?.availablePackages ?? [];
    if (!pkgs.length) return undefined;
    const wantYearly = plan.billing_interval === "yearly";
    return pkgs.find((p) => {
      const id = p.product.identifier;
      const tier = planFromStoreProductIdentifier(id);
      const isYearly = id.includes("yearly");
      return tier === plan.plan_id && isYearly === wantYearly;
    });
  };

  const formatMoney = (plan: Plan) => {
    const raw = plan.price_amount;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"));
    if (!Number.isFinite(n) || n === 0) return t("subscriptions.free");
    const rcPackage = findPackageForPlan(plan);
    const rcPriceString = rcPackage?.product?.priceString;
    if (rcPriceString) return rcPriceString;
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
  const showNativePaywall =
    revenueCatNative &&
    !onboardingMode &&
    !hasPaid &&
    (packages.length > 0 || loadingOffering || offeringLoadFailed);

  return (
    <>
      <Stack.Screen
        options={{
          title: personalizedPathReason
            ? t("subscriptions.personalizedPathTitle")
            : onboardingMode
              ? "Choose your plan to get started"
              : t("footer.subscriptions"),
          headerShown: true,
          headerTintColor: c.primary,
          headerBackVisible: !onboardingMode,
          gestureEnabled: !onboardingMode,
          headerLeft: onboardingMode ? () => null : undefined,
        }}
      />
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={styles.ambientTop} pointerEvents="none">
          <SubGlow
            width={460}
            height={260}
            color={LUX.goldWarm}
            opacity={0.08}
            stopFar={0.65}
          />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.container, { paddingBottom: 56 }]}
        >
        {/* ── Header ── */}
        {!showNativePaywall ? (
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: LUX.faint }]}>
              {t("footer.subscriptions").toUpperCase()}
            </Text>
            <Text style={[styles.editorial, { color: c.text }]}>
              {personalizedPathReason
                ? t("subscriptions.personalizedPathTitle")
                : t("subscriptions.choosePlan")}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {personalizedPathReason
                ? t("subscriptions.personalizedPathIntro")
                : t("subscriptions.intro")}
            </Text>
          </View>
        ) : null}

        {/* ── Alerts ── */}
        {ent?.fallback ? (
          <View
            style={[styles.alertBanner, { backgroundColor: c.accent + "22" }]}
          >
            <Text style={[styles.alertText, { color: c.accent }]}>
              {t("subscriptions.fallbackEntitlements")}
            </Text>
          </View>
        ) : null}
        {selectionError ? (
          <View
            style={[styles.alertBanner, { backgroundColor: c.error + "18" }]}
          >
            <Text style={[styles.alertText, { color: c.error }]}>
              {selectionError}
            </Text>
          </View>
        ) : null}
        {activatingPurchase ? (
          <GlassCard padding="md" style={{ marginBottom: spacing.md }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>
              {t("subscriptions.activatingTitle")}
            </Text>
            <Text style={[styles.cardBody, { color: c.textMuted }]}>
              {t("subscriptions.activatingBody")}
            </Text>
          </GlassCard>
        ) : null}

        {/* ── Already paid ── */}
        {hasPaid ? (
          <GlassCard padding="lg" style={{ marginBottom: spacing.lg }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>
              {t("subscriptions.subscriptionStatus")}
            </Text>
            <Text style={[styles.cardBody, { color: c.textMuted }]}>
              {t("subscriptions.statusPaid")}
            </Text>
            <GlassButton
              variant="active"
              size="md"
              style={{ marginTop: spacing.md }}
              onPress={() => void onManageStore()}
            >
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
            {!revenueCatNative ? (
              <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  {t("subscriptions.rcRequiredTitle")}
                </Text>
                <Text style={[styles.cardBody, { color: c.textMuted }]}>
                  {t("subscriptions.rcRequiredBody")}
                </Text>
              </GlassCard>
            ) : null}

            {/* ── Tier + billing toggles ── */}
            {revenueCatNative ? (
              <View style={styles.togglesWrap}>
                {showNativePaywall ? (
                  <View
                    style={[
                      styles.segmentPill,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <GlassButton
                      variant={storefrontTier === "plus" ? "active" : "ghost"}
                      size="sm"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setStorefrontTier("plus");
                        void loadRevenueCatOffering("plus");
                      }}
                    >
                      {t("subscriptions.plus")}
                    </GlassButton>
                    <GlassButton
                      variant={storefrontTier === "pro" ? "active" : "ghost"}
                      size="sm"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setStorefrontTier("pro");
                        void loadRevenueCatOffering("pro");
                      }}
                    >
                      {t("subscriptions.pro")}
                    </GlassButton>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.segmentPill,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <View style={{ flex: 1, position: "relative" }}>
                    <GlassButton
                      variant={
                        billingInterval === "yearly" ? "active" : "ghost"
                      }
                      size="sm"
                      style={{ flex: 1 }}
                      onPress={() => setBillingInterval("yearly")}
                    >
                      {t("subscriptions.billingYearly")}
                    </GlassButton>
                    <View
                      style={[
                        styles.discountBadge,
                        {
                          backgroundColor:
                            billingInterval === "yearly"
                              ? LUX.gold
                              : "rgba(230,200,122,0.15)",
                        },
                      ]}
                      pointerEvents="none"
                    >
                      <Text
                        style={[
                          styles.discountText,
                          {
                            color:
                              billingInterval === "yearly"
                                ? brand.bgDark
                                : LUX.goldWarm,
                          },
                        ]}
                      >
                        −20%
                      </Text>
                    </View>
                  </View>
                  <GlassButton
                    variant={billingInterval === "monthly" ? "active" : "ghost"}
                    size="sm"
                    style={{ flex: 1 }}
                    onPress={() => setBillingInterval("monthly")}
                  >
                    {t("subscriptions.billingMonthly")}
                  </GlassButton>
                </View>
              </View>
            ) : null}

            {/* ── Native paywall ── */}
            {showNativePaywall ? (
              <GarzoniRevenueCatPaywall
                variant="hero"
                style={{ marginTop: spacing.md }}
                offering={offering}
                billingInterval={billingInterval}
                hideMarketingHeader
                loading={loadingOffering}
                loadError={offeringLoadFailed}
                purchasingId={purchasingId}
                onPurchase={onRcPurchase}
                onRetryLoad={() => void loadRevenueCatOffering()}
                onRestore={() => void onRestoreRc()}
                onManagePress={() => void onManageStore()}
              />
            ) : (
              /* ── Plan cards ── */
              <View style={{ marginTop: spacing.sm }}>
                {plansQ.isPending ? (
                  <Text
                    style={[
                      styles.cardBody,
                      { color: c.textMuted, textAlign: "center" },
                    ]}
                  >
                    {t("subscriptions.loadingPlans")}
                  </Text>
                ) : null}
                {revenueCatNative && loadingOffering ? (
                  <Text
                    style={[
                      styles.cardBody,
                      { color: c.textMuted, marginBottom: spacing.md },
                    ]}
                  >
                    {t("subscriptions.loadingPlans")}
                  </Text>
                ) : null}
                {planCards.length === 0 && !plansQ.isPending ? (
                  <Text style={[styles.cardBody, { color: c.textMuted }]}>
                    {t("subscriptions.paymentNotConfigured")}
                  </Text>
                ) : null}

                {planCards.map((plan) => {
                  const isStarter =
                    plan.plan_id === "starter" ||
                    Number(plan.price_amount || 0) === 0;
                  const isHighlight = plan.plan_id === "plus";
                  const name =
                    plan.name ||
                    plan.plan_id.charAt(0).toUpperCase() +
                      plan.plan_id.slice(1);
                  const features = Object.values(plan.features || {})
                    .map((f) => f?.description || f?.name)
                    .filter(Boolean) as string[];
                  const paidPlanDisabled =
                    !isStarter &&
                    (!revenueCatNative ||
                      loadingOffering ||
                      packages.length === 0);
                  const ctaLabel = isStarter
                    ? t("subscriptions.startStarter")
                    : t("subscriptions.choosePlanCheckout", { name });

                  return (
                    <View
                      key={`${plan.plan_id}-${plan.billing_interval}`}
                      style={[
                        styles.planCard,
                        {
                          backgroundColor: c.surface,
                          borderColor: isHighlight ? "#E6C87A88" : c.border,
                          borderWidth: isHighlight
                            ? 2
                            : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      {/* Recommended badge */}
                      {isHighlight ? (
                        <View style={styles.recommendedWrap}>
                          <View style={styles.recommendedBadge}>
                            <Text style={styles.recommendedText}>
                              Recommended
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {/* Plan name + free badge */}
                      <View style={styles.planNameRow}>
                        <Text style={[styles.planName, { color: c.text }]}>
                          {name}
                        </Text>
                        {isStarter ? (
                          <View
                            style={[
                              styles.freeBadge,
                              { backgroundColor: c.success + "22" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.freeBadgeText,
                                { color: c.success },
                              ]}
                            >
                              {t("subscriptions.free")}
                            </Text>
                          </View>
                        ) : plan.trial_days ? (
                          <View
                            style={[
                              styles.freeBadge,
                              { backgroundColor: c.primary + "18" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.freeBadgeText,
                                { color: c.primary },
                              ]}
                            >
                              {t("subscriptions.trialDays", {
                                count: plan.trial_days,
                              })}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Price */}
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceAmount, { color: c.text }]}>
                          {formatMoney(plan)}
                        </Text>
                        {!isStarter ? (
                          <Text
                            style={[styles.pricePer, { color: c.textMuted }]}
                          >
                            {" / "}
                            {plan.billing_interval === "yearly"
                              ? t("subscriptions.perYear")
                              : t("subscriptions.perMonth")}
                          </Text>
                        ) : null}
                      </View>

                      {/* Feature list */}
                      {features.length > 0 ? (
                        <View style={styles.featureList}>
                          {features.map((fe) => (
                            <View key={fe} style={styles.featureRow}>
                              <MaterialCommunityIcons
                                name="check-circle"
                                size={15}
                                color={c.primary}
                                style={{ marginTop: 1 }}
                              />
                              <Text
                                style={[styles.featureText, { color: c.text }]}
                              >
                                {fe}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {/* CTA */}
                      <GlassButton
                        variant={isHighlight ? "active" : "ghost"}
                        size="md"
                        style={{ marginTop: spacing.md }}
                        loading={Boolean(purchasingId) && !isStarter}
                        disabled={paidPlanDisabled}
                        onPress={() => void handlePlanSelect(plan)}
                      >
                        {ctaLabel}
                      </GlassButton>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Feature comparison table ── */}
            {comparisonRows.length > 0 &&
            !revenueCatNative &&
            packages.length === 0 ? (
              <GlassCard padding="md" style={{ marginTop: spacing.xl }}>
                <Text style={[styles.compareLabel, { color: c.textMuted }]}>
                  {t("subscriptions.comparePlans")}
                </Text>
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  {t("subscriptions.seeWhatChanges")}
                </Text>
                <View
                  style={[
                    styles.tableHeader,
                    {
                      backgroundColor: c.surfaceOffset,
                      borderRadius: radius.sm,
                      marginTop: spacing.md,
                    },
                  ]}
                >
                  <Text style={[styles.colFeature, { color: c.textMuted }]}>
                    {t("subscriptions.feature")}
                  </Text>
                  <Text style={[styles.col, { color: c.textMuted }]}>
                    {t("subscriptions.starter")}
                  </Text>
                  <Text style={[styles.col, { color: c.textMuted }]}>
                    {t("subscriptions.plus")}
                  </Text>
                  <Text style={[styles.col, { color: c.textMuted }]}>
                    {t("subscriptions.pro")}
                  </Text>
                </View>
                {comparisonRows.slice(0, 12).map((row, i) => (
                  <View
                    key={row.feature}
                    style={[
                      styles.tableRow,
                      {
                        borderBottomColor: c.border,
                        borderBottomWidth:
                          i < comparisonRows.slice(0, 12).length - 1
                            ? StyleSheet.hairlineWidth
                            : 0,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.colFeature, { color: c.text }]}
                      numberOfLines={3}
                    >
                      {row.feature}
                    </Text>
                    <Text style={[styles.col, { color: c.textMuted }]}>
                      {row.starter}
                    </Text>
                    <Text
                      style={[
                        styles.col,
                        { color: c.primary, fontWeight: "600" },
                      ]}
                    >
                      {row.plus}
                    </Text>
                    <Text style={[styles.col, { color: c.textMuted }]}>
                      {row.pro}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            ) : null}
          </>
        ) : null}

        {/* ── Legal ── */}
        {revenueCatNative ? (
          <Text style={[styles.legal, { color: c.textFaint }]}>
            {t("billing.subscriptionsLegalIos")}
          </Text>
        ) : null}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
  },
  ambientTop: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "500",
    marginBottom: 10,
    textAlign: "center",
  },
  editorial: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "500",
    letterSpacing: -0.8,
    marginBottom: 10,
    textAlign: "center",
  },
  discountBadge: {
    position: "absolute",
    top: -6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    zIndex: 2,
  },
  discountText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  divider: {
    width: 48,
    height: 1,
    marginBottom: spacing.md,
    borderRadius: 1,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  alertBanner: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  alertText: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: typography.base,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  togglesWrap: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  segmentPill: {
    flexDirection: "row",
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xs,
  },
  planCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  recommendedWrap: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  recommendedBadge: {
    backgroundColor: "#E6C87A",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  recommendedText: {
    color: "#0B0F14",
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  planName: {
    fontSize: typography.lg,
    fontWeight: "700",
  },
  freeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  freeBadgeText: {
    fontSize: typography.xs,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: spacing.sm,
  },
  priceAmount: {
    fontSize: typography.xxl,
    fontWeight: "800",
  },
  pricePer: {
    fontSize: typography.xs,
    fontWeight: "500",
    marginLeft: 2,
  },
  featureList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  featureText: {
    fontSize: typography.sm,
    lineHeight: 20,
    flex: 1,
  },
  compareLabel: {
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    alignItems: "flex-start",
  },
  colFeature: {
    flex: 2,
    fontSize: typography.xs,
    fontWeight: "600",
  },
  col: {
    flex: 1,
    fontSize: typography.xs,
    textAlign: "center",
  },
  legal: {
    fontSize: typography.xs,
    lineHeight: 16,
    marginTop: spacing.xl,
    textAlign: "center",
  },
});
