import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";
import {
  fetchEntitlements,
  fetchProfile,
  queryKeys,
  staleTimes,
  type Entitlements,
} from "@garzoni/core";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { radius, spacing, typography } from "../src/theme/tokens";
import { brand } from "../src/theme/brand";
import { getRevenueCatPurchases } from "../src/billing/safeRevenueCat";
import {
  configureRevenueCatForUser,
  identifyRevenueCatUser,
  fetchRevenueCatOfferingByIdentifier,
  fetchRevenueCatPaywallOffering,
  RC_OFFERING_PLUS,
  RC_OFFERING_PRO,
  waitForActiveSubscription,
} from "../src/billing/subscriptionRuntime";
import { useAuthSession } from "../src/auth/AuthContext";

// ─── Design constants (brand-specific, always dark) ──────────────────────────

const D = {
  bg: brand.bgDark,
  surface: "#111827",
  surfaceRaised: "#161f2e",
  primary: brand.green,
  primaryBright: "#2a7347",
  primarySoft: "rgba(29,83,48,0.18)",
  gold: brand.gold,
  goldWarm: brand.goldWarm,
  border: brand.borderGlass,
  borderSoft: "rgba(255,255,255,0.06)",
  text: brand.text,
  muted: brand.textMuted,
  faint: "rgba(229,231,235,0.4)",
  ghost: "rgba(229,231,235,0.12)",
} as const;

const DISPLAY_FONT: string = Platform.OS === "ios" ? "Georgia" : "serif";

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLAN_DATA = {
  plus: {
    id: "plus" as const,
    name: "Plus",
    tagline: "A personalised path",
    perks: [
      "Personalised learning path",
      "Unlimited calculators",
      "Progress insights & reminders",
    ],
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    tagline: "The full toolkit",
    perks: [
      "Everything in Plus",
      "Advanced simulations & analytics",
      "Early access to new tools",
      "Priority AI guidance",
    ],
    recommended: true,
  },
};

const COMPARE_ROWS: {
  label: string;
  starter: boolean;
  plus: boolean;
  pro: boolean;
}[] = [
  { label: "Guided lessons", starter: true, plus: true, pro: true },
  { label: "Daily streaks & XP", starter: true, plus: true, pro: true },
  { label: "Personalised path", starter: false, plus: true, pro: true },
  { label: "Unlimited calculators", starter: false, plus: true, pro: true },
  { label: "Advanced simulations", starter: false, plus: false, pro: true },
  { label: "Priority AI guidance", starter: false, plus: false, pro: true },
  {
    label: "Early access to new tools",
    starter: false,
    plus: false,
    pro: true,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "plus" | "pro";
type Cycle = "monthly" | "yearly";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickPackage(
  pkgs: PurchasesPackage[] | undefined,
  cycle: Cycle,
): PurchasesPackage | null {
  if (!pkgs?.length) return null;
  const want = cycle === "yearly" ? "ANNUAL" : "MONTHLY";
  return pkgs.find((p) => String(p.packageType) === want) ?? null;
}

function planFromEntitlements(ent?: Entitlements | null): Tier | "starter" {
  const p = typeof ent?.plan === "string" ? ent.plan : null;
  if (p === "plus" || p === "pro") return p;
  return "starter";
}

function planRank(plan?: string | null) {
  if (plan === "pro") return 2;
  if (plan === "plus") return 1;
  return 0;
}

function intervalFromEntitlements(ent?: Entitlements | null): Cycle | null {
  const raw = ent?.billing_interval;
  if (raw === "yearly" || raw === "monthly") return raw;
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AmbientGlow() {
  return (
    <View style={styles.glowWrap} pointerEvents="none">
      <Svg width={460} height={260}>
        <Defs>
          <RadialGradient id="ag" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={D.goldWarm} stopOpacity={0.1} />
            <Stop offset="65%" stopColor={D.goldWarm} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={230} cy={130} rx={230} ry={130} fill="url(#ag)" />
      </Svg>
    </View>
  );
}

function CycleToggle({
  value,
  onChange,
  savingsPct,
}: {
  value: Cycle;
  onChange: (v: Cycle) => void;
  savingsPct: number | null;
}) {
  return (
    <View style={styles.cycleWrap}>
      {(["monthly", "yearly"] as const).map((k) => {
        const active = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={[styles.cyclePill, active && styles.cyclePillActive]}
          >
            <Text
              style={[styles.cycleLabel, { color: active ? D.text : D.muted }]}
            >
              {k === "yearly" ? "Yearly" : "Monthly"}
            </Text>
            {k === "yearly" && savingsPct !== null && (
              <View
                style={[
                  styles.cycleBadge,
                  {
                    backgroundColor: active ? D.gold : "rgba(230,200,122,0.15)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cycleBadgeText,
                    { color: active ? D.bg : D.goldWarm },
                  ]}
                >
                  -{savingsPct}%
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function TierCard({
  plan,
  pkg,
  cycle,
  isCurrent,
  loading,
  onPress,
}: {
  plan: (typeof PLAN_DATA)[Tier];
  pkg: PurchasesPackage | null;
  cycle: Cycle;
  isCurrent: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const isPro = plan.id === "pro";
  const accent = isPro ? D.goldWarm : D.primaryBright;
  const price = pkg?.product.priceString ?? "—";
  const per = cycle === "yearly" ? "/ month, billed annually" : "/ month";
  const intro = pkg?.product.introPrice;
  const showTrial = Boolean(intro && intro.price === 0);
  const disabled = !pkg || isCurrent;
  const ctaLabel = isCurrent
    ? "Current plan"
    : `Start ${plan.name}${cycle === "yearly" ? " — Annual" : ""}`;

  return (
    <View style={[styles.tierCard, isPro && styles.tierCardPro]}>
      {/* Recommended pill */}
      {isPro && (
        <View style={styles.recommendedWrap}>
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>RECOMMENDED</Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.tierHead}>
        <View style={styles.tierNameRow}>
          <View style={[styles.tierDot, { backgroundColor: accent }]} />
          <Text
            style={[styles.tierName, { color: isPro ? D.goldWarm : D.text }]}
          >
            {plan.name}
          </Text>
        </View>
        <Text style={[styles.tierTagline, { fontFamily: DISPLAY_FONT }]}>
          {plan.tagline}
        </Text>
        {showTrial && (
          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>
              {intro?.periodNumberOfUnits ?? 0} day free trial
            </Text>
          </View>
        )}
        {isCurrent && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>Current</Text>
          </View>
        )}
      </View>

      {/* Price */}
      <View style={styles.priceRow}>
        <Text style={[styles.price, { fontFamily: DISPLAY_FONT }]}>
          {price}
        </Text>
      </View>
      <Text style={styles.pricePer}>{per}</Text>

      {/* Perks */}
      <View style={styles.perkList}>
        {plan.perks.map((p) => (
          <View key={p} style={styles.perkRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={15}
              color={accent}
            />
            <Text style={styles.perkText}>{p}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[
          styles.tierCta,
          isPro ? styles.tierCtaPro : styles.tierCtaPlus,
          (disabled || loading) && styles.tierCtaDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isPro ? D.bg : "#fff"} size="small" />
        ) : (
          <Text style={[styles.tierCtaText, { color: isPro ? D.bg : "#fff" }]}>
            {ctaLabel}
          </Text>
        )}
      </Pressable>
      {!pkg && !loading && !isCurrent && (
        <Text style={styles.pkgUnavailableText}>
          Pricing unavailable — check your connection and try again.
        </Text>
      )}
    </View>
  );
}

function CompareMatrix() {
  const [open, setOpen] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const EXPANDED_HEIGHT = COMPARE_ROWS.length * 44 + 56;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: open ? EXPANDED_HEIGHT : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [open, heightAnim, EXPANDED_HEIGHT]);

  const CellMark = ({ ok, gold }: { ok: boolean; gold?: boolean }) =>
    ok ? (
      <MaterialCommunityIcons
        name="check-circle"
        size={14}
        color={gold ? D.goldWarm : D.primaryBright}
      />
    ) : (
      <View style={styles.dashMark} />
    );

  return (
    <GlassCard padding="none" style={styles.compareCard}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.compareToggleRow}
      >
        <Text style={styles.compareToggleLabel}>Compare all features</Text>
        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={D.muted}
        />
      </Pressable>

      <Animated.View style={{ height: heightAnim, overflow: "hidden" }}>
        <View style={styles.compareInner}>
          {/* Column headers */}
          <View style={styles.compareHeaderRow}>
            <Text style={[styles.compareColLabel, { flex: 2 }]}>Feature</Text>
            <Text style={styles.compareColLabel}>Free</Text>
            <Text style={styles.compareColLabel}>Plus</Text>
            <Text style={[styles.compareColLabel, { color: D.goldWarm }]}>
              Pro
            </Text>
          </View>
          {COMPARE_ROWS.map((row, i) => (
            <View
              key={row.label}
              style={[
                styles.compareRow,
                i < COMPARE_ROWS.length - 1 && styles.compareRowBorder,
              ]}
            >
              <Text style={[styles.compareFeature, { flex: 2 }]}>
                {row.label}
              </Text>
              <View style={styles.compareCell}>
                <CellMark ok={row.starter} />
              </View>
              <View style={styles.compareCell}>
                <CellMark ok={row.plus} />
              </View>
              <View style={styles.compareCell}>
                <CellMark ok={row.pro} gold />
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    </GlassCard>
  );
}

function StatusChip({
  plan,
  interval,
}: {
  plan: Tier | "starter";
  interval: Cycle | null;
}) {
  const label =
    plan === "starter"
      ? "Free plan"
      : `${plan === "plus" ? "Plus" : "Pro"}${interval ? ` · ${interval === "yearly" ? "Yearly" : "Monthly"}` : ""}`;
  const dotColor =
    plan === "pro" ? D.goldWarm : plan === "plus" ? D.primaryBright : D.faint;

  return (
    <View style={styles.statusChipWrap}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={styles.statusChipText}>
        {plan === "starter" ? "You're on the " : "You're on "}
        <Text style={{ color: D.text, fontWeight: "500" }}>{label}</Text>
        {plan !== "starter" && " plan"}
      </Text>
    </View>
  );
}

function UtilityLinks({
  onRestore,
  onManageStore,
}: {
  onRestore: () => void;
  onManageStore: () => void;
}) {
  return (
    <View style={styles.utilityWrap}>
      <Pressable onPress={onRestore}>
        <Text style={styles.utilityLink}>Restore purchases</Text>
      </Pressable>
      <Text style={styles.utilityDot}>·</Text>
      <Pressable onPress={onManageStore}>
        <Text style={styles.utilityLink}>Manage subscription</Text>
      </Pressable>
    </View>
  );
}

// ─── Purchase progress overlay ───────────────────────────────────────────────

function PurchaseProgressOverlay({
  step,
  tier,
  error,
  onRetry,
  onDismiss,
}: {
  step: "syncing" | "success" | "error";
  tier: Tier | null;
  error: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const tierLabel = tier === "pro" ? "Pro" : "Plus";
  const accent = tier === "pro" ? D.goldWarm : D.primaryBright;

  return (
    <View style={styles.overlayBackdrop} pointerEvents="auto">
      <View style={styles.overlayCard}>
        {step === "syncing" && (
          <>
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.overlayTitle}>
              Activating Garzoni {tierLabel}…
            </Text>
            <Text style={styles.overlayBody}>
              Apple has confirmed your purchase. Just syncing your account —
              this only takes a few seconds.
            </Text>
          </>
        )}

        {step === "success" && (
          <>
            <View style={[styles.overlayCheck, { backgroundColor: accent }]}>
              <MaterialCommunityIcons name="check" size={36} color="#fff" />
            </View>
            <Text style={[styles.overlayTitle, { color: accent }]}>
              You're all set
            </Text>
            <Text style={styles.overlayBody}>
              Welcome to Garzoni {tierLabel}. Your new tools are unlocked.
            </Text>
          </>
        )}

        {step === "error" && (
          <>
            <View
              style={[
                styles.overlayCheck,
                { backgroundColor: "rgba(220,38,38,0.85)" },
              ]}
            >
              <MaterialCommunityIcons name="alert" size={32} color="#fff" />
            </View>
            <Text style={styles.overlayTitle}>Almost there</Text>
            <Text style={styles.overlayBody}>
              {error ?? "We couldn't activate your subscription. Please retry."}
            </Text>
            <View style={styles.overlayBtnRow}>
              <Pressable
                style={[styles.overlayBtn, styles.overlayBtnPrimary]}
                onPress={onRetry}
              >
                <Text style={styles.overlayBtnPrimaryText}>Retry</Text>
              </Pressable>
              <Pressable
                style={[styles.overlayBtn, styles.overlayBtnSecondary]}
                onPress={onDismiss}
              >
                <Text style={styles.overlayBtnSecondaryText}>Close</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SubscriptionsScreen() {
  const c = useThemeColors();
  const { top: topInset } = useSafeAreaInsets();
  const { accessToken } = useAuthSession();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    onboarding?: string | string[];
  }>();

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const onboardingParam = Array.isArray(params.onboarding)
    ? params.onboarding[0]
    : params.onboarding;
  const legacyPaywall = String(onboardingParam ?? "").toLowerCase() === "true";
  const isPaywall =
    String(modeParam ?? "").toLowerCase() === "paywall" || legacyPaywall;

  const rcNative = useMemo(() => getRevenueCatPurchases() !== null, []);
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [plusPkgs, setPlusPkgs] = useState<PurchasesPackage[] | null>(null);
  const [proPkgs, setProPkgs] = useState<PurchasesPackage[] | null>(null);
  const [loading, setLoading] = useState(rcNative);
  const [purchasingTier, setPurchasingTier] = useState<Tier | null>(null);
  const [purchaseStep, setPurchaseStep] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

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

  const currentPlan = planFromEntitlements(entQ.data);
  const currentInterval = intervalFromEntitlements(entQ.data);

  const loadOfferings = useCallback(async () => {
    if (!rcNative) return;
    const userId = profileQ.data?.user?.toString();
    if (!configureRevenueCatForUser(userId)) {
      setLoading(false);
      return;
    }
    // If the user is identified, ensure RC's session is logged in under their
    // real ID. This transfers any anonymous purchases so backend sync works.
    if (userId) {
      await identifyRevenueCatUser(userId);
    }
    setLoading(true);
    try {
      const [plus, pro] = await Promise.all([
        fetchRevenueCatPaywallOffering({ offeringId: RC_OFFERING_PLUS }).catch(
          () => null,
        ),
        fetchRevenueCatOfferingByIdentifier(RC_OFFERING_PRO).catch(() => null),
      ]);
      setPlusPkgs(plus?.availablePackages ?? []);
      setProPkgs(pro?.availablePackages ?? []);
    } finally {
      setLoading(false);
    }
  }, [profileQ.data?.user, rcNative]);

  useEffect(() => {
    if (!rcNative) return;
    // When unauthenticated (onboarding paywall, Apple review), load immediately with anonymous RC user.
    // When authenticated, wait for profile so RC is configured with the correct user ID.
    if (accessToken && !profileQ.isFetched) return;
    void loadOfferings();
  }, [
    loadOfferings,
    accessToken,
    profileQ.isFetched,
    profileQ.data?.user,
    rcNative,
  ]);

  const onPurchase = useCallback(
    async (tier: Tier, pkg: PurchasesPackage) => {
      const rc = getRevenueCatPurchases();
      if (!rc) return;
      setPurchasingTier(tier);
      setPurchaseError(null);
      try {
        // 1. Apple's native purchase flow (RC SDK shows the system overlay)
        await rc.Purchases.purchasePackage(pkg);

        // 2. Backend sync — show our own progress UI now
        setPurchaseStep("syncing");
        const entitlements = await waitForActiveSubscription(queryClient);

        if (entitlements && planRank(entitlements.plan) >= 1) {
          setPurchaseStep("success");
          setTimeout(() => {
            setPurchaseStep("idle");
            setPurchasingTier(null);
            if (isPaywall) router.replace("/(tabs)");
            else router.back();
          }, 1400);
        } else {
          // Apple confirmed but backend didn't catch up — surface a retry
          setPurchaseError(
            "Your purchase went through, but we couldn't activate it yet. Tap retry below.",
          );
          setPurchaseStep("error");
        }
      } catch (e: unknown) {
        const err = e as {
          code?: string;
          userCancelled?: boolean;
          message?: string;
        };
        // User cancelled the Apple sheet — silent dismiss
        if (
          err.userCancelled ||
          err.code === rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ) {
          setPurchasingTier(null);
          setPurchaseStep("idle");
          return;
        }
        setPurchaseError(err.message ?? "Please try again.");
        setPurchaseStep("error");
      }
    },
    [isPaywall, queryClient],
  );

  const onRetrySync = useCallback(async () => {
    setPurchaseStep("syncing");
    setPurchaseError(null);
    try {
      const entitlements = await waitForActiveSubscription(queryClient, {
        maxAttempts: 5,
        delayMs: 1500,
      });
      if (entitlements && planRank(entitlements.plan) >= 1) {
        setPurchaseStep("success");
        setTimeout(() => {
          setPurchaseStep("idle");
          setPurchasingTier(null);
          if (isPaywall) router.replace("/(tabs)");
          else router.back();
        }, 1400);
      } else {
        setPurchaseError(
          "Still no luck. Tap Restore Purchases or contact support if this persists.",
        );
        setPurchaseStep("error");
      }
    } catch {
      setPurchaseError("Retry failed. Please try Restore Purchases.");
      setPurchaseStep("error");
    }
  }, [isPaywall, queryClient]);

  const dismissPurchaseOverlay = useCallback(() => {
    setPurchaseStep("idle");
    setPurchasingTier(null);
    setPurchaseError(null);
  }, []);

  const onRestore = useCallback(async () => {
    const rc = getRevenueCatPurchases();
    if (!rc) return;
    setRestoring(true);
    try {
      await rc.Purchases.restorePurchases();
      const entitlements = await waitForActiveSubscription(queryClient, {
        maxAttempts: 3,
        delayMs: 1000,
      });
      if (entitlements && planRank(entitlements.plan) >= 1) {
        Alert.alert(
          "Restored",
          `Welcome back to Garzoni ${entitlements.plan === "pro" ? "Pro" : "Plus"}.`,
        );
      } else {
        Alert.alert(
          "Nothing to restore",
          "We couldn't find an active subscription on this Apple ID.",
        );
      }
    } catch (e: unknown) {
      Alert.alert(
        "Restore failed",
        (e as { message?: string }).message ?? "Please try again.",
      );
    } finally {
      setRestoring(false);
    }
  }, [queryClient]);

  const onManageStore = useCallback(async () => {
    const url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions";
    await Linking.openURL(url).catch(() => null);
  }, []);

  const plusPkg = pickPackage(plusPkgs ?? undefined, cycle);
  const proPkg = pickPackage(proPkgs ?? undefined, cycle);

  // Compute real savings % from Plus packages (monthly vs annual/12).
  const savingsPct = useMemo<number | null>(() => {
    if (!plusPkgs?.length) return null;
    const monthly = pickPackage(plusPkgs, "monthly");
    const annual = pickPackage(plusPkgs, "yearly");
    if (!monthly?.product.price || !annual?.product.price) return null;
    const monthlyPrice = monthly.product.price;
    const annualPerMonth = annual.product.price / 12;
    const pct = Math.round(
      ((monthlyPrice - annualPerMonth) / monthlyPrice) * 100,
    );
    return pct > 0 ? pct : null;
  }, [plusPkgs]);

  return (
    <>
      <Stack.Screen
        options={{
          title: isPaywall ? "Choose your plan" : "Manage Plan",
          headerShown: !isPaywall,
          headerStyle: { backgroundColor: D.bg },
          gestureEnabled: !isPaywall,
        }}
      />
      <View style={styles.root}>
        <AmbientGlow />

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            isPaywall && { paddingTop: topInset + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContent}>
            {/* Eyebrow */}
            <Text style={styles.eyebrow}>Subscription</Text>

            {/* Editorial headline */}
            <Text style={styles.headline}>
              Pick the plan that{" "}
              <Text
                style={[styles.headlineEmphasis, { fontFamily: DISPLAY_FONT }]}
              >
                moves you forward
              </Text>
              .
            </Text>

            {/* Status chip */}
            <StatusChip plan={currentPlan} interval={currentInterval} />

            {/* No-RC warning */}
            {!rcNative ? (
              <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  In-app purchases unavailable
                </Text>
                <Text style={[styles.cardBody, { color: c.textMuted }]}>
                  Rebuild the native app to enable subscriptions.
                </Text>
              </GlassCard>
            ) : (
              <>
                {/* Cycle toggle */}
                <View style={styles.cycleContainer}>
                  <CycleToggle
                    value={cycle}
                    onChange={setCycle}
                    savingsPct={savingsPct}
                  />
                </View>

                {/* Tier cards */}
                {loading ? (
                  <GlassCard padding="lg" style={{ marginBottom: spacing.md }}>
                    <ActivityIndicator color={D.primaryBright} />
                  </GlassCard>
                ) : (
                  <>
                    <TierCard
                      plan={PLAN_DATA.plus}
                      pkg={plusPkg}
                      cycle={cycle}
                      isCurrent={
                        currentPlan === "plus" && currentInterval === cycle
                      }
                      loading={purchasingTier === "plus"}
                      onPress={() =>
                        plusPkg && void onPurchase("plus", plusPkg)
                      }
                    />
                    <TierCard
                      plan={PLAN_DATA.pro}
                      pkg={proPkg}
                      cycle={cycle}
                      isCurrent={
                        currentPlan === "pro" && currentInterval === cycle
                      }
                      loading={purchasingTier === "pro"}
                      onPress={() => proPkg && void onPurchase("pro", proPkg)}
                    />
                  </>
                )}

                {/* Compare matrix */}
                <CompareMatrix />
              </>
            )}

            {/* Utility links — manage mode */}
            {!isPaywall && (
              <UtilityLinks
                onRestore={() => void onRestore()}
                onManageStore={() => void onManageStore()}
              />
            )}

            {/* Paywall footer: restore + skip (Apple guideline 3.1.1) */}
            {isPaywall && (
              <View style={styles.paywallFooter}>
                <Pressable
                  onPress={() => void onRestore()}
                  accessibilityRole="button"
                >
                  <Text style={styles.utilityLink}>Restore purchases</Text>
                </Pressable>
                <Text style={styles.utilityDot}>·</Text>
                <Pressable
                  onPress={() => router.replace("/(tabs)")}
                  accessibilityRole="button"
                >
                  <Text style={styles.skipText}>Skip for now</Text>
                </Pressable>
              </View>
            )}

            {/* Legal — iOS only (Apple IAP copy) */}
            {Platform.OS === "ios" && (
              <>
                <Text style={styles.legal}>
                  Subscriptions renew automatically. Cancel anytime in your
                  Apple ID settings. Payment charged to your Apple ID on
                  confirmation.
                </Text>
                <View style={styles.legalLinks}>
                  <Pressable
                    onPress={() => router.push("/legal/terms")}
                    accessibilityRole="link"
                  >
                    <Text style={styles.legalLink}>Terms of Use</Text>
                  </Pressable>
                  <Text style={styles.utilityDot}>·</Text>
                  <Pressable
                    onPress={() => router.push("/legal/privacy")}
                    accessibilityRole="link"
                  >
                    <Text style={styles.legalLink}>Privacy Policy</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {/* Purchase progress overlay (syncing → success → error) */}
        {purchaseStep !== "idle" && (
          <PurchaseProgressOverlay
            step={purchaseStep}
            tier={purchasingTier}
            error={purchaseError}
            onRetry={() => void onRetrySync()}
            onDismiss={dismissPurchaseOverlay}
          />
        )}

        {/* Restore in-progress overlay */}
        {restoring && (
          <View style={styles.overlayBackdrop} pointerEvents="auto">
            <View style={styles.overlayCard}>
              <ActivityIndicator size="large" color={D.primaryBright} />
              <Text style={styles.overlayTitle}>Restoring purchases…</Text>
              <Text style={styles.overlayBody}>
                Checking your Apple ID for active subscriptions.
              </Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: D.bg,
  },
  glowWrap: {
    position: "absolute",
    top: -60,
    alignSelf: "center",
    pointerEvents: "none",
  },
  scroll: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: 56,
  },

  // Header
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: D.faint,
    fontWeight: "500",
    marginBottom: 10,
  },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "500",
    letterSpacing: -0.8,
    color: D.text,
    marginBottom: 14,
  },
  headlineEmphasis: {
    color: D.goldWarm,
    fontStyle: "italic",
  },

  // Status chip
  statusChipWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: D.ghost,
    alignSelf: "flex-start",
    marginBottom: 22,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 12,
    color: D.muted,
  },

  // Cycle toggle
  cycleContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  cycleWrap: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: D.surface,
    borderWidth: 1,
    borderColor: D.border,
  },
  cyclePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: radius.full,
  },
  cyclePillActive: {
    backgroundColor: D.bg,
  },
  cycleLabel: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
    textTransform: "capitalize",
  },
  cycleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  cycleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  // Tier card
  tierCard: {
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: 14,
    backgroundColor: D.surfaceRaised,
    borderWidth: 1,
    borderColor: D.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 6,
  },
  tierCardPro: {
    backgroundColor: D.surface,
    borderColor: "rgba(230,200,122,0.55)",
    shadowColor: D.goldWarm,
    shadowOpacity: 0.15,
  },
  recommendedWrap: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  recommendedBadge: {
    backgroundColor: D.gold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    shadowColor: D.goldWarm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  recommendedText: {
    color: D.bg,
    fontSize: typography.xs,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  tierHead: {
    marginBottom: spacing.sm,
  },
  tierNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierName: {
    fontSize: typography.lg,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  tierTagline: {
    fontSize: 13,
    color: D.muted,
    fontStyle: "italic",
    marginLeft: 16,
    marginBottom: 4,
  },
  trialBadge: {
    alignSelf: "flex-start",
    marginLeft: 16,
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: "rgba(230,200,122,0.15)",
  },
  trialText: {
    fontSize: typography.xs,
    fontWeight: "700",
    color: D.goldWarm,
  },
  currentBadge: {
    alignSelf: "flex-start",
    marginLeft: 16,
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: D.ghost,
  },
  currentBadgeText: {
    fontSize: typography.xs,
    color: D.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  price: {
    fontSize: 40,
    fontWeight: "400",
    color: D.text,
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  pricePer: {
    fontSize: 12,
    color: D.faint,
    marginBottom: spacing.lg,
  },
  perkList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkText: {
    fontSize: typography.sm,
    color: D.text,
    opacity: 0.92,
    flex: 1,
  },
  tierCta: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 5,
  },
  tierCtaPlus: {
    backgroundColor: "#2a7347",
    shadowColor: "#1d5330",
    shadowOpacity: 0.45,
  },
  tierCtaPro: {
    backgroundColor: D.gold,
    shadowColor: D.goldWarm,
    shadowOpacity: 0.35,
  },
  tierCtaDisabled: {
    opacity: 0.5,
  },
  tierCtaText: {
    fontSize: typography.base,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // Compare matrix
  compareCard: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  compareToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  compareToggleLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: D.text,
  },
  compareInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  compareHeaderRow: {
    flexDirection: "row",
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: D.borderSoft,
    marginBottom: 4,
  },
  compareColLabel: {
    flex: 1,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: D.faint,
    textAlign: "center",
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },
  compareRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.borderSoft,
  },
  compareFeature: {
    fontSize: 13,
    color: D.text,
  },
  compareCell: {
    flex: 1,
    alignItems: "center",
  },
  dashMark: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: D.ghost,
  },

  // Utility links
  utilityWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.sm,
    marginBottom: 14,
  },
  utilityLink: {
    fontSize: 13,
    color: D.muted,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(229,231,235,0.25)",
  },
  utilityDot: {
    fontSize: 13,
    color: D.faint,
  },

  // Skip / legal
  paywallFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  skipWrap: {
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  skipText: {
    fontSize: typography.sm,
    color: D.faint,
    fontWeight: "500",
  },
  legal: {
    fontSize: 11,
    color: D.faint,
    lineHeight: 16,
    textAlign: "center",
    marginTop: spacing.lg,
    maxWidth: 300,
    alignSelf: "center",
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

  // iPad centering
  innerContent: {
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },

  // Pkg unavailable hint
  pkgUnavailableText: {
    fontSize: 11,
    color: D.faint,
    textAlign: "center",
    marginTop: 8,
  },

  // Legal links in purchase flow
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  legalLink: {
    fontSize: 11,
    color: D.muted,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(229,231,235,0.3)",
  },

  // ── Purchase progress overlay ──────────────────────────────────────────────
  overlayBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11,15,20,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    zIndex: 10,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: D.surfaceRaised,
    borderWidth: 1,
    borderColor: D.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 12,
  },
  overlayCheck: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: D.text,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  overlayBody: {
    fontSize: 13,
    color: D.muted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: spacing.sm,
  },
  overlayBtnRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
    marginTop: 4,
  },
  overlayBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayBtnPrimary: {
    backgroundColor: D.primaryBright,
  },
  overlayBtnPrimaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  overlayBtnSecondary: {
    backgroundColor: D.ghost,
  },
  overlayBtnSecondaryText: {
    color: D.text,
    fontWeight: "600",
    fontSize: 14,
  },
});
