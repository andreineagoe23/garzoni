import { useMemo } from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { PACKAGE_TYPE } from "react-native-purchases";
import GlassButton from "../ui/GlassButton";
import GlassCard from "../ui/GlassCard";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";
import { planFromStoreProductIdentifier } from "../../billing/subscriptionRuntime";
import {
  filterPackagesByBillingInterval,
  paywallPackageTypeI18nKey,
  shouldMarkAnnualBestValue,
  sortPackagesForPaywall,
  subscriptionPeriodI18nKey,
} from "../../billing/rcPaywallUtils";

export type GarzoniPaywallVariant = "hero" | "compact";

type GarzoniRevenueCatPaywallProps = {
  variant?: GarzoniPaywallVariant;
  offering: PurchasesOffering | null;
  loading: boolean;
  loadError?: boolean;
  purchasingId: string | null;
  onPurchase: (pkg: PurchasesPackage) => void;
  onRetryLoad?: () => void;
  onRestore?: () => void;
  onManagePress?: () => void;
  showRestore?: boolean;
  style?: StyleProp<ViewStyle>;
  /** When set, only annual or only monthly packages are shown (like web plans page). */
  billingInterval?: "yearly" | "monthly";
  /** Hide title/subtitle block (parent screen already explains context). */
  hideMarketingHeader?: boolean;
};

function tierLabel(
  pkg: PurchasesPackage,
  t: (k: string) => string,
): string | null {
  const plan = planFromStoreProductIdentifier(pkg.product.identifier);
  if (plan === "pro") return t("subscriptions.pro");
  return t("subscriptions.plus");
}

export default function GarzoniRevenueCatPaywall({
  variant = "hero",
  offering,
  loading,
  loadError = false,
  purchasingId,
  onPurchase,
  onRetryLoad,
  onRestore,
  onManagePress,
  showRestore = true,
  style,
  billingInterval = "yearly",
  hideMarketingHeader = false,
}: GarzoniRevenueCatPaywallProps) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const storeName =
    Platform.OS === "ios"
      ? t("subscriptions.paywallStoreApple")
      : t("subscriptions.paywallStoreGoogle");

  const sorted = useMemo(() => {
    const raw = offering?.availablePackages ?? [];
    const ordered = sortPackagesForPaywall(raw);
    return filterPackagesByBillingInterval(ordered, billingInterval);
  }, [offering?.availablePackages, billingInterval]);

  const compact = variant === "compact";

  if (loadError && !loading && sorted.length === 0) {
    return (
      <View style={style}>
        <GlassCard padding="md">
          <Text style={[styles.errorText, { color: c.textMuted }]}>
            {t("subscriptions.paywallRetry")}
          </Text>
          {onRetryLoad ? (
            <GlassButton
              variant="active"
              size="sm"
              style={{ marginTop: spacing.sm }}
              onPress={onRetryLoad}
            >
              {t("onboarding.tryAgain")}
            </GlassButton>
          ) : null}
        </GlassCard>
      </View>
    );
  }

  if (loading && sorted.length === 0) {
    return (
      <View style={style}>
        <Text style={[styles.loadingText, { color: c.textMuted }]}>
          {t("subscriptions.loadingPlans")}
        </Text>
      </View>
    );
  }

  if (sorted.length === 0) return null;

  return (
    <View style={style}>
      {!hideMarketingHeader && !compact ? (
        <View style={styles.heroBlock}>
          <Text style={[styles.heroTitle, { color: c.text }]}>
            {t("subscriptions.paywallTitle")}
          </Text>
          <Text style={[styles.heroSubtitle, { color: c.textMuted }]}>
            {t("subscriptions.paywallSubtitle")}{" "}
            {t("subscriptions.paywallFeatureCancel", { store: storeName })}
          </Text>
        </View>
      ) : null}
      {!hideMarketingHeader && compact ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.compactTitle, { color: c.text }]}>
            {t("subscriptions.paywallCompactTitle")}
          </Text>
          <Text style={[styles.compactSubtitle, { color: c.textMuted }]}>
            {t("subscriptions.paywallCompactSubtitle")}
          </Text>
        </View>
      ) : null}

      {sorted.map((pkg) => {
        const product = pkg.product;
        const periodKey = subscriptionPeriodI18nKey(product.subscriptionPeriod);
        const periodSuffix = periodKey ? ` / ${t(periodKey)}` : "";
        const tier = tierLabel(pkg, t);
        const best = shouldMarkAnnualBestValue(sorted, pkg);
        const intro = product.introPrice;
        const equiv =
          pkg.packageType === PACKAGE_TYPE.ANNUAL &&
          product.pricePerMonthString
            ? t("subscriptions.paywallEquivMonthly", {
                price: product.pricePerMonthString,
              })
            : null;

        return (
          <GlassCard
            key={pkg.identifier + product.identifier}
            padding="lg"
            style={[
              { marginBottom: spacing.md },
              best
                ? {
                    borderWidth: 1,
                    borderColor: c.primary,
                  }
                : null,
            ]}
          >
            {best ? (
              <View
                style={[
                  styles.ribbon,
                  { backgroundColor: c.primary + "28" },
                ]}
              >
                <Text style={[styles.ribbonText, { color: c.primary }]}>
                  {t("subscriptions.paywallBestValue")}
                </Text>
              </View>
            ) : null}
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                {tier ? (
                  <View
                    style={[
                      styles.tierPill,
                      { backgroundColor: c.primary + "18" },
                    ]}
                  >
                    <Text style={[styles.tierPillText, { color: c.primary }]}>
                      {tier}
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.productTitle, { color: c.text }]}>
                  {product.title}
                </Text>
                <Text style={[styles.packageKind, { color: c.textMuted }]}>
                  {t(paywallPackageTypeI18nKey(pkg.packageType))}
                  {periodSuffix}
                </Text>
                {product.description ? (
                  <Text
                    style={[styles.description, { color: c.textMuted }]}
                    numberOfLines={compact ? 2 : 3}
                  >
                    {product.description}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.priceBlock}>
              <Text style={[styles.priceMain, { color: c.text }]}>
                {product.priceString}
              </Text>
              {equiv ? (
                <Text style={[styles.priceHint, { color: c.textMuted }]}>
                  {equiv}
                </Text>
              ) : null}
              {intro ? (
                <Text style={[styles.introLine, { color: c.primary }]}>
                  {t("subscriptions.paywallIntroLine", {
                    price: intro.priceString,
                  })}
                </Text>
              ) : null}
            </View>
            <GlassButton
              variant="active"
              size={compact ? "md" : "lg"}
              loading={purchasingId === product.identifier}
              onPress={() => onPurchase(pkg)}
              style={{ marginTop: spacing.md }}
            >
              {t("subscriptions.paywallSubscribe")}
            </GlassButton>
          </GlassCard>
        );
      })}

      <View style={styles.footerRow}>
        {showRestore && onRestore ? (
          <GlassButton variant="ghost" size="sm" onPress={onRestore}>
            {t("billing.restorePurchases")}
          </GlassButton>
        ) : null}
        {onManagePress ? (
          <GlassButton variant="ghost" size="sm" onPress={onManagePress}>
            {t("billing.manageSubscription")}
          </GlassButton>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBlock: { marginBottom: spacing.lg },
  heroTitle: {
    fontSize: typography.xl,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: 0,
  },
  compactTitle: {
    fontSize: typography.xl,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  compactSubtitle: { fontSize: typography.sm, lineHeight: 20 },
  ribbon: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  ribbonText: { fontSize: typography.xs, fontWeight: "700" },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  tierPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  tierPillText: { fontSize: typography.xs, fontWeight: "700" },
  productTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    marginBottom: 4,
  },
  packageKind: { fontSize: typography.xs, marginBottom: spacing.sm },
  description: { fontSize: typography.sm, lineHeight: 20 },
  priceBlock: { marginTop: spacing.md },
  priceMain: { fontSize: typography.xxl, fontWeight: "800" },
  priceHint: { fontSize: typography.xs, marginTop: 2 },
  introLine: { fontSize: typography.sm, marginTop: spacing.xs },
  footerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingText: { fontSize: typography.sm, marginBottom: spacing.md },
  errorText: { fontSize: typography.sm, lineHeight: 20 },
});
