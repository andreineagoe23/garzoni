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
import { useTranslation } from "react-i18next";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import {
  fetchEntitlements,
  fetchProfile,
  postSubscriptionSync,
  queryKeys,
  staleTimes,
  type Entitlements,
} from "@garzoni/core";
import GlassButton from "../src/components/ui/GlassButton";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";
import { getRevenueCatPurchases } from "../src/billing/safeRevenueCat";
import GarzoniRevenueCatPaywall from "../src/components/billing/GarzoniRevenueCatPaywall";
import {
  configureRevenueCatForUser,
  fetchRevenueCatPaywallOffering,
  refreshSubscriptionQueries,
  waitForActiveSubscription,
} from "../src/billing/subscriptionRuntime";
import { href } from "../src/navigation/href";

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

export default function BillingScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const revenueCatNative = useMemo(() => getRevenueCatPurchases() !== null, []);
  const queryClient = useQueryClient();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [offeringLoadFailed, setOfferingLoadFailed] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
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
          await queryClient.invalidateQueries({
            queryKey: queryKeys.profile(),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.entitlements(),
          });
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
      configureRevenueCatForUser(userId);
      void loadOffering();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQ.isFetched, profileQ.data]);

  async function loadOffering() {
    if (!getRevenueCatPurchases()) {
      setLoadingOffering(false);
      return;
    }
    setLoadingOffering(true);
    setOfferingLoadFailed(false);
    try {
      setOffering(await fetchRevenueCatPaywallOffering());
    } catch (e) {
      setOfferingLoadFailed(true);
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
        await waitForActiveSubscription(queryClient);
        Alert.alert(
          t("billing.purchaseSuccessTitle"),
          t("billing.purchaseSuccessBody"),
        );
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code !== rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          setErr(t("billing.purchaseError"));
        }
      } finally {
        setPurchasingId(null);
      }
    },
    [queryClient, t],
  );

  const onRestore = useCallback(async () => {
    const rc = getRevenueCatPurchases();
    if (!rc) return;
    setErr("");
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
      setErr(t("billing.restoreFailed"));
    }
  }, [queryClient, t]);

  const onManageStore = useCallback(async () => {
    setErr("");
    const rc = getRevenueCatPurchases();
    const showManageSubscriptions = (rc?.Purchases as {
      showManageSubscriptions?: () => Promise<void>;
    } | null)?.showManageSubscriptions;
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
      setErr(t("billing.failedPortal"));
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
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      >
        <GlassCard padding="lg" style={{ marginBottom: spacing.xl }}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>
            {t("billing.currentPlan")}
          </Text>
          <View style={styles.planRow}>
            <PlanBadge
              label={t("billing.starter")}
              active={plan === "starter"}
              c={c}
            />
            <PlanBadge
              label={t("billing.plus")}
              active={plan === "plus"}
              c={c}
            />
            <PlanBadge label={t("billing.pro")} active={plan === "pro"} c={c} />
          </View>
          <Text style={[styles.statusText, { color: c.textMuted }]}>
            {label} · {status}
          </Text>
          {plan === "starter" ? (
            <Text
              style={[
                styles.hint,
                { color: c.textFaint, marginTop: spacing.xs },
              ]}
            >
              {t("billing.starterPlanBody")}
            </Text>
          ) : null}
        </GlassCard>

        {!isSubscribed && packages.length > 0 && (
          <View style={{ marginBottom: spacing.xl }}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              {t("billing.unlockPremium")}
            </Text>
            <GarzoniRevenueCatPaywall
              variant="compact"
              offering={offering}
              loading={loadingOffering}
              loadError={offeringLoadFailed}
              purchasingId={purchasingId}
              onPurchase={onPurchase}
              onRetryLoad={() => void loadOffering()}
              showRestore={false}
              onManagePress={() => router.push(href("/subscriptions"))}
            />
          </View>
        )}

        {loadingOffering ? (
          <Text style={[styles.hint, { color: c.textMuted }]}>
            {t("billing.loadingPlans")}
          </Text>
        ) : null}

        {!loadingOffering &&
        packages.length === 0 &&
        !isSubscribed &&
        offeringLoadFailed ? (
          <GlassCard padding="md" style={{ marginBottom: spacing.xl }}>
            <Text
              style={[
                styles.hint,
                { color: c.textMuted, marginBottom: spacing.md },
              ]}
            >
              {t("subscriptions.paywallRetry")}
            </Text>
            <GlassButton variant="active" size="md" onPress={() => void loadOffering()}>
              {t("onboarding.tryAgain")}
            </GlassButton>
          </GlassCard>
        ) : null}

        {!loadingOffering &&
        packages.length === 0 &&
        !isSubscribed &&
        !offeringLoadFailed ? (
          <GlassCard padding="md" style={{ marginBottom: spacing.xl }}>
            <Text
              style={[
                styles.hint,
                { color: c.textMuted, marginBottom: spacing.md },
              ]}
            >
              {t("billing.noNativePlansHint")}
            </Text>
            <GlassButton
              variant="active"
              size="md"
              onPress={() => router.push(href("/subscriptions"))}
            >
              {t("billing.explorePlansMobile")}
            </GlassButton>
          </GlassCard>
        ) : null}

        {err ? (
          <Text style={[styles.error, { color: c.error }]}>{err}</Text>
        ) : null}

        <View style={styles.actions}>
          {isSubscribed && revenueCatNative ? (
            <GlassButton variant="active" size="lg" onPress={() => void onManageStore()}>
              {Platform.OS === "ios"
                ? t("billing.manageInAppStore")
                : t("billing.manageInPlayStore")}
            </GlassButton>
          ) : null}

          {revenueCatNative ? (
            <GlassButton
              variant="ghost"
              size="md"
              onPress={() => void onRestore()}
            >
              {t("billing.restorePurchases")}
            </GlassButton>
          ) : null}

          {!isSubscribed ? (
            <GlassButton
              variant="ghost"
              size="md"
              onPress={() => router.push(href("/subscriptions"))}
            >
              {t("billing.explorePlans")}
            </GlassButton>
          ) : null}
        </View>

        <Text style={[styles.legal, { color: c.textFaint }]}>
          {t("billing.subscriptionsLegalIos")}
        </Text>
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
