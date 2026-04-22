import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import GlassButton from "../src/components/ui/GlassButton";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { radius, spacing, typography } from "../src/theme/tokens";
import { getRevenueCatPurchases } from "../src/billing/safeRevenueCat";
import {
  configureRevenueCatForUser,
  fetchRevenueCatOfferingByIdentifier,
  fetchRevenueCatPaywallOffering,
  RC_OFFERING_PLUS,
  RC_OFFERING_PRO,
  waitForActiveSubscription,
} from "../src/billing/subscriptionRuntime";
import { useAuthSession } from "../src/auth/AuthContext";

type Tier = "plus" | "pro";
type Cycle = "monthly" | "yearly";
type Mode = "paywall" | "manage";

type TierPerks = { tagline: string; perks: string[] };

const PERKS: Record<Tier, TierPerks> = {
  plus: {
    tagline: "Daily practice, smarter feedback, full streak tools.",
    perks: [
      "Unlimited daily lessons",
      "AI feedback on every answer",
      "Streak freeze & weekly digest",
      "Offline practice library",
    ],
  },
  pro: {
    tagline: "Everything in Plus, plus personalized path & coaching.",
    perks: [
      "Everything in Plus",
      "Personalized learning path",
      "1:1 AI coach sessions",
      "Priority support",
    ],
  },
};

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

function intervalFromEntitlements(ent?: Entitlements | null): Cycle | null {
  const raw = ent?.billing_interval;
  if (raw === "yearly" || raw === "monthly") return raw;
  return null;
}

export default function SubscriptionsScreen() {
  const c = useThemeColors();
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
  const legacyPaywall =
    String(onboardingParam ?? "").toLowerCase() === "true";
  const mode: Mode =
    String(modeParam ?? "").toLowerCase() === "paywall" || legacyPaywall
      ? "paywall"
      : "manage";
  const isPaywall = mode === "paywall";

  const rcNative = useMemo(() => getRevenueCatPurchases() !== null, []);
  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [plusPkgs, setPlusPkgs] = useState<PurchasesPackage[] | null>(null);
  const [proPkgs, setProPkgs] = useState<PurchasesPackage[] | null>(null);
  const [loading, setLoading] = useState(rcNative);
  const [purchasingTier, setPurchasingTier] = useState<Tier | null>(null);

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
    if (!rcNative || !profileQ.isFetched) return;
    void loadOfferings();
  }, [loadOfferings, profileQ.isFetched, rcNative]);

  const onPurchase = useCallback(
    async (tier: Tier, pkg: PurchasesPackage) => {
      const rc = getRevenueCatPurchases();
      if (!rc) return;
      setPurchasingTier(tier);
      try {
        await rc.Purchases.purchasePackage(pkg);
        await waitForActiveSubscription(queryClient);
        if (isPaywall) router.replace("/(tabs)");
      } catch (e: unknown) {
        const err = e as { code?: string; userCancelled?: boolean; message?: string };
        if (
          err.userCancelled ||
          err.code === rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
        ) {
          return;
        }
        Alert.alert("Purchase failed", err.message ?? "Please try again.");
      } finally {
        setPurchasingTier(null);
      }
    },
    [isPaywall, queryClient],
  );

  const onRestore = useCallback(async () => {
    const rc = getRevenueCatPurchases();
    if (!rc) return;
    try {
      await rc.Purchases.restorePurchases();
      await waitForActiveSubscription(queryClient, {
        maxAttempts: 3,
        delayMs: 1000,
      });
      Alert.alert("Restored", "Your purchases are up to date.");
    } catch (e: unknown) {
      Alert.alert(
        "Restore failed",
        (e as { message?: string }).message ?? "Please try again.",
      );
    }
  }, [queryClient]);

  const onManageStore = useCallback(async () => {
    const url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions";
    try {
      await Linking.openURL(url);
    } catch {
      /* no-op */
    }
  }, []);

  const plusPkg = pickPackage(plusPkgs ?? undefined, cycle);
  const proPkg = pickPackage(proPkgs ?? undefined, cycle);

  return (
    <>
      <Stack.Screen
        options={{
          title: isPaywall ? "Choose your plan" : "Manage Plan",
          headerShown: !isPaywall,
          headerTintColor: c.primary,
          gestureEnabled: !isPaywall,
        }}
      />
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: 56 }]}
        >
          {isPaywall ? (
            <View style={styles.header}>
              <Text style={[styles.title, { color: c.text }]}>
                Unlock Garzoni
              </Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Pick a plan to start practicing every day. Cancel anytime.
              </Text>
            </View>
          ) : null}

          {!isPaywall ? (
            <StatusChip plan={currentPlan} interval={currentInterval} />
          ) : null}

          {!rcNative ? (
            <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.cardTitle, { color: c.text }]}>
                In-app purchases unavailable
              </Text>
              <Text style={[styles.cardBody, { color: c.textMuted }]}>
                Rebuild the app with the native RevenueCat module to subscribe.
              </Text>
            </GlassCard>
          ) : (
            <>
              <CycleToggle value={cycle} onChange={setCycle} />

              {loading ? (
                <GlassCard padding="lg" style={{ marginBottom: spacing.md }}>
                  <ActivityIndicator color={c.primary} />
                </GlassCard>
              ) : (
                <>
                  <TierCard
                    plan="plus"
                    pkg={plusPkg}
                    isCurrent={
                      currentPlan === "plus" && currentInterval === cycle
                    }
                    billingCycle={cycle}
                    loading={purchasingTier === "plus"}
                    onPress={() => plusPkg && void onPurchase("plus", plusPkg)}
                  />
                  <TierCard
                    plan="pro"
                    pkg={proPkg}
                    isCurrent={
                      currentPlan === "pro" && currentInterval === cycle
                    }
                    billingCycle={cycle}
                    loading={purchasingTier === "pro"}
                    onPress={() => proPkg && void onPurchase("pro", proPkg)}
                  />
                </>
              )}
            </>
          )}

          {!isPaywall ? (
            <UtilityLinks
              onRestore={() => void onRestore()}
              onManageStore={() => void onManageStore()}
            />
          ) : null}

          {isPaywall ? (
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={styles.skipWrap}
              accessibilityRole="button"
            >
              <Text style={[styles.skipText, { color: c.textFaint }]}>
                Skip for now
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </>
  );
}

function CycleToggle({
  value,
  onChange,
}: {
  value: Cycle;
  onChange: (v: Cycle) => void;
}) {
  const c = useThemeColors();
  return (
    <GlassCard padding="sm" style={styles.cycleCard}>
      <View style={styles.cycleRow}>
        {(["monthly", "yearly"] as const).map((k) => {
          const active = value === k;
          return (
            <Pressable
              key={k}
              onPress={() => onChange(k)}
              style={[
                styles.cyclePill,
                {
                  backgroundColor: active ? c.primary : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.cycleLabel,
                  { color: active ? c.textOnPrimary : c.text },
                ]}
              >
                {k === "yearly" ? "Yearly" : "Monthly"}
              </Text>
              {k === "yearly" ? (
                <View
                  style={[
                    styles.cycleBadge,
                    {
                      backgroundColor: active
                        ? c.textOnPrimary
                        : c.accentMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cycleBadgeText,
                      { color: active ? c.primary : c.accent },
                    ]}
                  >
                    -20%
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

function TierCard({
  plan,
  pkg,
  isCurrent,
  billingCycle,
  loading,
  onPress,
}: {
  plan: Tier;
  pkg: PurchasesPackage | null;
  isCurrent: boolean;
  billingCycle: Cycle;
  loading: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const perks = PERKS[plan];
  const name = plan === "plus" ? "Plus" : "Pro";
  const price = pkg?.product.priceString ?? "—";
  const per = billingCycle === "yearly" ? "/ year" : "/ month";
  const intro = pkg?.product.introPrice;
  const showTrial = intro && intro.price === 0;

  const disabled = !pkg || isCurrent;
  const ctaLabel = isCurrent ? "Current plan" : `Get ${name}`;
  const highlight = plan === "plus";

  return (
    <GlassCard
      padding="lg"
      style={[
        styles.tierCard,
        highlight && { borderColor: c.accent, borderWidth: 2 },
      ]}
    >
      <View style={styles.tierHead}>
        <Text style={[styles.tierName, { color: c.text }]}>{name}</Text>
        {showTrial ? (
          <View
            style={[styles.trialBadge, { backgroundColor: c.accentMuted }]}
          >
            <Text style={[styles.trialText, { color: c.accent }]}>
              {intro?.periodNumberOfUnits ?? 0} day free trial
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.tagline, { color: c.textMuted }]}>
        {perks.tagline}
      </Text>

      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: c.text }]}>{price}</Text>
        {pkg ? (
          <Text style={[styles.pricePer, { color: c.textMuted }]}>{per}</Text>
        ) : null}
      </View>

      <View style={styles.perkList}>
        {perks.perks.map((p) => (
          <View key={p} style={styles.perkRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color={c.primary}
            />
            <Text style={[styles.perkText, { color: c.text }]}>{p}</Text>
          </View>
        ))}
      </View>

      <GlassButton
        variant={isCurrent ? "ghost" : highlight ? "active" : "primary"}
        size="md"
        loading={loading}
        disabled={disabled}
        onPress={onPress}
        style={{ marginTop: spacing.md }}
      >
        {ctaLabel}
      </GlassButton>
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
  const c = useThemeColors();
  const label =
    plan === "starter"
      ? "Free plan"
      : `${plan === "plus" ? "Plus" : "Pro"}${interval ? ` · ${interval === "yearly" ? "Yearly" : "Monthly"}` : ""}`;
  const bg =
    plan === "pro"
      ? c.accentMuted
      : plan === "plus"
        ? c.successBg
        : c.surfaceOffset;
  const color =
    plan === "pro" ? c.accent : plan === "plus" ? c.success : c.textMuted;
  return (
    <View style={styles.chipWrap}>
      <View style={[styles.chip, { backgroundColor: bg }]}>
        <Text style={[styles.chipText, { color }]}>{label}</Text>
      </View>
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
  const c = useThemeColors();
  return (
    <GlassCard padding="md" style={{ marginTop: spacing.lg }}>
      <Pressable style={styles.utilityRow} onPress={onRestore}>
        <Text style={[styles.utilityText, { color: c.textMuted }]}>
          Restore purchases
        </Text>
      </Pressable>
      <View style={[styles.utilityDivider, { borderTopColor: c.border }]} />
      <Pressable style={styles.utilityRow} onPress={onManageStore}>
        <Text style={[styles.utilityText, { color: c.textMuted }]}>
          Manage in App Store
        </Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.xl },
  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: typography.base,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  cardBody: { fontSize: typography.sm, lineHeight: 20 },

  cycleCard: { marginBottom: spacing.lg, alignSelf: "center" },
  cycleRow: { flexDirection: "row", gap: spacing.xs },
  cyclePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  cycleLabel: { fontSize: typography.sm, fontWeight: "600" },
  cycleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  cycleBadgeText: { fontSize: typography.xs, fontWeight: "700" },

  tierCard: { marginBottom: spacing.md },
  tierHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  tierName: { fontSize: typography.lg, fontWeight: "700" },
  trialBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  trialText: { fontSize: typography.xs, fontWeight: "700" },
  tagline: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: spacing.sm,
  },
  price: { fontSize: typography.xxl, fontWeight: "800" },
  pricePer: { fontSize: typography.sm, marginLeft: spacing.xs },
  perkList: { gap: spacing.sm, marginTop: spacing.sm },
  perkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  perkText: { fontSize: typography.sm, flex: 1 },

  chipWrap: { alignItems: "center", marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipText: {
    fontSize: typography.sm,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  utilityRow: { paddingVertical: spacing.md },
  utilityDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  utilityText: { fontSize: typography.sm, fontWeight: "500" },

  skipWrap: { alignItems: "center", marginTop: spacing.xl },
  skipText: { fontSize: typography.sm, fontWeight: "500" },
});

