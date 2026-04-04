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
import {
  fetchEntitlements,
  fetchProfile,
  postSubscriptionPortal,
  postSubscriptionSync,
  queryKeys,
  staleTimes,
  type Entitlements,
} from "@monevo/core";
import GlassButton from "../src/components/ui/GlassButton";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import { getRevenueCatPurchases } from "../src/billing/safeRevenueCat";
import { href } from "../src/navigation/href";

const PRODUCT_TO_PLAN: Record<string, "plus" | "pro"> = {
  "tech.monevo.app.plus_monthly": "plus",
  "tech.monevo.app.plus_yearly": "plus",
  "tech.monevo.app.pro_monthly": "pro",
  "tech.monevo.app.pro_yearly": "pro",
};

let revenueCatConfigured = false;

function configureRevenueCat(userId?: string) {
  const rc = getRevenueCatPurchases();
  if (!rc) return;
  const apiKey = Constants.expoConfig?.extra?.revenueCatApiKeyIos as
    | string
    | undefined;
  if (!apiKey || revenueCatConfigured) return;
  revenueCatConfigured = true;
  rc.Purchases.configure({ apiKey, appUserID: userId ?? null });
}

function PlanBadge({
  label,
  active,
  c,
}: {
  label: string;
  active: boolean;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={[
        styles.planBadge,
        {
          backgroundColor: active ? c.primary + "22" : c.border + "33",
          borderColor: active ? c.primary : c.border,
        },
      ]}
    >
      <Text
        style={[
          styles.planBadgeText,
          { color: active ? c.primary : c.textMuted },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function PackageRow({
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

export default function BillingScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const revenueCatNative = useMemo(() => getRevenueCatPurchases() !== null, []);
  const queryClient = useQueryClient();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [err, setErr] = useState("");
  const profileLoaded = useRef(false);

  const profileQ = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const entQ = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data as Entitlements),
    staleTime: staleTimes.entitlements,
  });

  const profilePayload = profileQ.data;
  const stripeSubscriptionId = useMemo(() => {
    if (!profilePayload) return null;
    const top = (profilePayload as { stripe_subscription_id?: string | null })
      .stripe_subscription_id;
    const ud = profilePayload.user_data as Record<string, unknown> | undefined;
    const nested = ud?.stripe_subscription_id as string | null | undefined;
    return top ?? nested ?? null;
  }, [profilePayload]);

  const plan = entQ.data?.plan ?? "starter";
  const status = String(entQ.data?.status ?? "inactive");
  const label = entQ.data?.label ?? plan;
  const portalEligible = ["active", "trialing"].includes(status);
  const isSubscribed = plan !== "starter" && portalEligible;

  useEffect(() => {
    if (!portalEligible) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await postSubscriptionSync();
        if (!cancelled && r.data?.ok) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
        }
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portalEligible, queryClient]);

  useEffect(() => {
    if (profileLoaded.current) return;
    const userId = profileQ.data?.user?.toString();
    if (profileQ.isFetched) {
      profileLoaded.current = true;
      configureRevenueCat(userId);
      loadOffering();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQ.isFetched, profileQ.data]);

  async function loadOffering() {
    const rc = getRevenueCatPurchases();
    if (!rc) {
      setLoadingOffering(false);
      return;
    }
    setLoadingOffering(true);
    try {
      const offerings = await rc.Purchases.getOfferings();
      setOffering(offerings.current);
    } catch (e) {
      if (__DEV__) console.warn("[Billing] RevenueCat getOfferings failed:", e);
    } finally {
      setLoadingOffering(false);
    }
  }

  const onPurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      const rc = getRevenueCatPurchases();
      if (!rc) return;
      setErr("");
      setPurchasingId(pkg.product.identifier);
      try {
        await rc.Purchases.purchasePackage(pkg);
        await queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
        Alert.alert(t("billing.purchaseSuccessTitle"), t("billing.purchaseSuccessBody"));
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code !== rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          setErr(t("billing.purchaseError"));
        }
      } finally {
        setPurchasingId(null);
      }
    },
    [queryClient, t]
  );

  const onRestore = useCallback(async () => {
    const rc = getRevenueCatPurchases();
    if (!rc) return;
    setErr("");
    try {
      await rc.Purchases.restorePurchases();
      await queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      Alert.alert(t("billing.restoreSuccessTitle"), t("billing.restoreSuccessBody"));
    } catch {
      setErr(t("billing.restoreFailed"));
    }
  }, [queryClient, t]);

  const onManageAppStore = useCallback(() => {
    void Linking.openURL("https://apps.apple.com/account/subscriptions");
  }, []);

  const onOpenStripePortal = useCallback(async () => {
    setErr("");
    setPortalBusy(true);
    try {
      const r = await postSubscriptionPortal();
      const url = r.data?.url;
      if (url && (await Linking.canOpenURL(url))) {
        await Linking.openURL(url);
      } else {
        setErr(t("billing.failedPortal"));
      }
    } catch {
      setErr(t("billing.failedPortal"));
    } finally {
      setPortalBusy(false);
    }
  }, [t]);

  const packages = offering?.availablePackages ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: t("billing.subscriptionManagement"),
          headerShown: true,
          headerTintColor: c.primary,
        }}
      />
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <GlassCard padding="lg" style={{ marginBottom: spacing.xl }}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {t("billing.currentPlan")}
          </Text>
          <View style={styles.planRow}>
            <PlanBadge label={t("billing.starter")} active={plan === "starter"} c={c} />
            <PlanBadge label={t("billing.plus")} active={plan === "plus"} c={c} />
            <PlanBadge label={t("billing.pro")} active={plan === "pro"} c={c} />
          </View>
          <Text style={[styles.statusText, { color: c.textMuted }]}>
            {label} · {status}
          </Text>
          {stripeSubscriptionId ? (
            <Text style={[styles.hint, { color: c.textFaint, marginTop: spacing.xs }]}>
              {t("billing.stripePortalFallback")}
            </Text>
          ) : null}
        </GlassCard>

        {!isSubscribed && packages.length > 0 && (
          <View style={{ marginBottom: spacing.xl }}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {t("billing.unlockPremium")}
            </Text>
            {packages.map((pkg) => (
              <PackageRow
                key={pkg.product.identifier}
                pkg={pkg}
                onPress={onPurchase}
                loading={purchasingId === pkg.product.identifier}
                c={c}
                subscribeLabel={t("billing.startPlan")}
              />
            ))}
          </View>
        )}

        {loadingOffering ? (
          <Text style={[styles.hint, { color: c.textMuted }]}>{t("billing.loadingPlans")}</Text>
        ) : null}

        {!loadingOffering && packages.length === 0 && !isSubscribed ? (
          <GlassCard padding="md" style={{ marginBottom: spacing.xl }}>
            <Text style={[styles.hint, { color: c.textMuted, marginBottom: spacing.md }]}>
              {t("billing.noNativePlansHint")}
            </Text>
            <GlassButton variant="active" size="md" onPress={() => router.push(href("/subscriptions"))}>
              {t("billing.explorePlansMobile")}
            </GlassButton>
          </GlassCard>
        ) : null}

        {err ? <Text style={[styles.error, { color: c.error }]}>{err}</Text> : null}

        <View style={styles.actions}>
          {Boolean(stripeSubscriptionId) && portalEligible ? (
            <GlassButton
              variant="active"
              size="lg"
              loading={portalBusy}
              onPress={() => void onOpenStripePortal()}
              style={{ marginBottom: spacing.sm }}
            >
              {t("billing.openCustomerPortal")}
            </GlassButton>
          ) : null}

          {isSubscribed && Platform.OS === "ios" && revenueCatNative ? (
            <GlassButton variant="active" size="lg" onPress={onManageAppStore}>
              {t("billing.manageInAppStore")}
            </GlassButton>
          ) : null}

          {Platform.OS === "ios" && revenueCatNative ? (
            <GlassButton variant="ghost" size="md" onPress={() => void onRestore()}>
              {t("billing.restorePurchases")}
            </GlassButton>
          ) : null}

          {!isSubscribed ? (
            <GlassButton variant="ghost" size="md" onPress={() => router.push(href("/subscriptions"))}>
              {t("billing.explorePlans")}
            </GlassButton>
          ) : null}
        </View>

        <Text style={[styles.legal, { color: c.textFaint }]}>{t("billing.subscriptionsLegalIos")}</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 48 },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  planRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  planBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  planBadgeText: { fontSize: typography.xs, fontWeight: "600" },
  statusText: { fontSize: typography.sm, marginTop: spacing.xs },
  pkgRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pkgTitle: { fontSize: typography.sm, fontWeight: "600", marginBottom: 2 },
  pkgPrice: { fontSize: typography.xs },
  hint: { fontSize: typography.sm, lineHeight: 20, marginBottom: spacing.md },
  error: { fontSize: typography.sm, marginBottom: spacing.md },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  legal: {
    fontSize: typography.xs,
    lineHeight: 16,
    marginTop: spacing.xl,
    textAlign: "center",
  },
});
