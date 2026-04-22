import { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useTranslation } from "react-i18next";
import type {
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";
import { PACKAGE_TYPE } from "react-native-purchases";
import { brand } from "../../theme/brand";
import { planFromStoreProductIdentifier } from "../../billing/subscriptionRuntime";
import {
  filterPackagesByBillingInterval,
  shouldMarkAnnualBestValue,
  sortPackagesForPaywall,
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
  billingInterval?: "yearly" | "monthly";
  hideMarketingHeader?: boolean;
};

const LUX = {
  bg: brand.bgDark,
  surface: brand.bgCard,
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
};

function resolveTier(pkg: PurchasesPackage): "plus" | "pro" {
  const t = planFromStoreProductIdentifier(pkg.product.identifier);
  return t === "pro" ? "pro" : "plus";
}

function perksFor(tier: "plus" | "pro", t: (k: string) => string): string[] {
  if (tier === "pro") {
    return [
      t("subscriptions.perksPro1"),
      t("subscriptions.perksPro2"),
      t("subscriptions.perksPro3"),
      t("subscriptions.perksPro4"),
    ].filter((v) => v && !v.startsWith("subscriptions.perks"));
  }
  return [
    t("subscriptions.perksPlus1"),
    t("subscriptions.perksPlus2"),
    t("subscriptions.perksPlus3"),
  ].filter((v) => v && !v.startsWith("subscriptions.perks"));
}

function perksFallback(tier: "plus" | "pro"): string[] {
  if (tier === "pro")
    return [
      "Everything in Plus",
      "Advanced simulations & analytics",
      "Early access to new tools",
      "Priority AI guidance",
    ];
  return [
    "Personalised learning path",
    "Unlimited calculators",
    "Progress insights & reminders",
  ];
}

function Check({ gold }: { gold?: boolean }) {
  const stroke = gold ? LUX.goldWarm : LUX.primaryBright;
  const fill = gold ? "rgba(230,200,122,0.15)" : LUX.primarySoft;
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={7} fill={fill} />
      <Path
        d="M4 7.2l2 2 4-4.5"
        stroke={stroke}
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function GoldGlow() {
  return (
    <Svg
      width={340}
      height={200}
      style={StyleSheet.absoluteFill as never}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="proGlow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={LUX.goldWarm} stopOpacity={0.18} />
          <Stop offset="70%" stopColor={LUX.goldWarm} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={170} cy={100} rx={170} ry={100} fill="url(#proGlow)" />
    </Svg>
  );
}

function TierCard({
  pkg,
  isBest,
  purchasing,
  onPress,
  t,
}: {
  pkg: PurchasesPackage;
  isBest: boolean;
  purchasing: boolean;
  onPress: () => void;
  t: (k: string) => string;
}) {
  const tier = resolveTier(pkg);
  const isPro = tier === "pro";
  const product = pkg.product;
  const isAnnual = pkg.packageType === PACKAGE_TYPE.ANNUAL;
  const accent = isPro ? LUX.goldWarm : LUX.primaryBright;
  const name = isPro ? "Pro" : "Plus";
  const tagline = isPro ? "The full toolkit" : "A personalised path";
  let perks = perksFor(tier, t);
  if (perks.length === 0) perks = perksFallback(tier);

  const periodLabel = isAnnual ? t("subscriptions.perYear") : t("subscriptions.perMonth");
  const monthlyEquivLabel =
    isAnnual && product.pricePerMonthString
      ? t("subscriptions.paywallEquivMonthly")
      : null;

  const trialLabel = (() => {
    const unitLabel = (n: number, unit: string) => {
      const u = unit.toUpperCase();
      if (u.startsWith("DAY")) return n === 1 ? "day" : "days";
      if (u.startsWith("WEEK")) return n === 1 ? "week" : "weeks";
      if (u.startsWith("MONTH")) return n === 1 ? "month" : "months";
      if (u.startsWith("YEAR")) return n === 1 ? "year" : "years";
      return "days";
    };
    // iOS: introPrice with price 0 == free trial
    const intro = product.introPrice;
    if (intro && intro.price === 0 && intro.periodNumberOfUnits > 0) {
      return `${intro.periodNumberOfUnits}-${unitLabel(intro.periodNumberOfUnits, intro.periodUnit)} free trial`;
    }
    // Google Play: defaultOption.freePhase
    const freePhase =
        (product as unknown as { defaultOption?: { freePhase?: unknown } })
        .defaultOption?.freePhase as
        | { billingPeriod?: { value?: number; unit?: string } }
        | undefined;
    const bp = freePhase?.billingPeriod;
    if (bp && typeof bp.value === "number" && bp.value > 0 && bp.unit) {
      return `${bp.value}-${unitLabel(bp.value, bp.unit)} free trial`;
    }
    // Fallback: scan all subscriptionOptions for any freePhase
    const opts = (product as unknown as { subscriptionOptions?: unknown })
      .subscriptionOptions as
      | Array<{ freePhase?: { billingPeriod?: { value?: number; unit?: string } } }>
      | null
      | undefined;
    if (Array.isArray(opts)) {
      for (const o of opts) {
        const p = o?.freePhase?.billingPeriod;
        if (p && typeof p.value === "number" && p.value > 0 && p.unit) {
          return `${p.value}-${unitLabel(p.value, p.unit)} free trial`;
        }
      }
    }
    return null;
  })();

  return (
    <View style={styles.cardWrap}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isPro
              ? "rgba(230,200,122,0.04)"
              : LUX.surfaceRaised,
            borderColor: isPro ? "rgba(230,200,122,0.55)" : LUX.border,
            borderWidth: isPro ? 1.5 : 1,
          },
        ]}
      >
        {isPro ? (
          <View style={styles.glowClip} pointerEvents="none">
            <GoldGlow />
          </View>
        ) : null}

        {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.nameWrap}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: accent,
                shadowColor: accent,
              },
            ]}
          />
          <Text
            style={[
              styles.tierName,
              { color: isPro ? LUX.goldWarm : LUX.text },
            ]}
          >
            {name}
          </Text>
        </View>
        <Text style={styles.tagline}>{tagline}</Text>
      </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{product.priceString}</Text>
          <Text style={styles.priceSuffix}>{periodLabel}</Text>
        </View>
        {monthlyEquivLabel && product.pricePerMonthString ? (
          <Text style={styles.priceHint}>
            {`${product.pricePerMonthString} / month equivalent`}
          </Text>
        ) : (
          <Text style={styles.priceHint}>
            {isAnnual
              ? "Billed annually · cancel anytime"
              : "Billed monthly · cancel anytime"}
          </Text>
        )}
        {trialLabel ? (
          <View
            style={[
              styles.trialPill,
              {
                backgroundColor: isPro
                  ? "rgba(230,200,122,0.15)"
                  : "rgba(42,115,71,0.18)",
                borderColor: isPro
                  ? "rgba(230,200,122,0.45)"
                  : "rgba(42,115,71,0.45)",
              },
            ]}
          >
            <Text
              style={[
                styles.trialText,
                { color: isPro ? LUX.goldWarm : LUX.primaryBright },
              ]}
            >
              {`✦ ${trialLabel}`}
            </Text>
          </View>
        ) : null}

        {/* Perks */}
        <View style={styles.perks}>
          {perks.map((p, i) => (
            <View key={i} style={styles.perkRow}>
              <Check gold={isPro} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={onPress}
          disabled={purchasing}
          style={[styles.cta, { opacity: purchasing ? 0.75 : 1 }]}
        >
        {isPro ? (
          <Svg
            style={StyleSheet.absoluteFill as never}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="proCta" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={LUX.gold} stopOpacity={1} />
                <Stop offset="100%" stopColor={LUX.goldWarm} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#proCta)" />
          </Svg>
        ) : (
          <Svg
            style={StyleSheet.absoluteFill as never}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="plusCta" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={LUX.primaryBright} stopOpacity={1} />
                <Stop offset="100%" stopColor={LUX.primary} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#plusCta)" />
          </Svg>
        )}
        <View style={styles.ctaHighlight} pointerEvents="none" />
        {purchasing ? (
          <ActivityIndicator color={isPro ? "#0b0f14" : "#fff"} />
        ) : (
          <Text
            style={[
              styles.ctaLabel,
              { color: isPro ? "#0b0f14" : "#fff" },
            ]}
          >
            {`Start ${name}${isAnnual ? " — Annual" : ""}`}
          </Text>
        )}
        </Pressable>
      </View>
      {isPro || isBest ? (
        <View style={styles.recommendedPill} pointerEvents="none">
          <Text style={styles.recommendedText}>Recommended</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function GarzoniRevenueCatPaywall({
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
}: GarzoniRevenueCatPaywallProps) {
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

  if (loadError && !loading && sorted.length === 0) {
    return (
      <View style={[styles.stateCard, style]}>
        <Text style={styles.stateText}>{t("subscriptions.paywallRetry")}</Text>
        {onRetryLoad ? (
          <Pressable onPress={onRetryLoad} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>{t("onboarding.tryAgain")}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (loading && sorted.length === 0) {
    return (
      <View style={[styles.stateCard, style]}>
        <ActivityIndicator color={LUX.primaryBright} />
        <Text style={[styles.stateText, { marginTop: 10 }]}>
          {t("subscriptions.loadingPlans")}
        </Text>
      </View>
    );
  }

  if (sorted.length === 0) return null;

  return (
    <View style={style}>
      {sorted.map((pkg) => (
        <TierCard
          key={pkg.identifier + pkg.product.identifier}
          pkg={pkg}
          isBest={shouldMarkAnnualBestValue(sorted, pkg)}
          purchasing={purchasingId === pkg.product.identifier}
          onPress={() => onPurchase(pkg)}
          t={t}
        />
      ))}

      <View style={styles.footerLinks}>
        {showRestore && onRestore ? (
          <Pressable onPress={onRestore} hitSlop={10}>
            <Text style={styles.link}>{t("billing.restorePurchases")}</Text>
          </Pressable>
        ) : null}
        {showRestore && onRestore && onManagePress ? (
          <Text style={styles.linkSep}>·</Text>
        ) : null}
        {onManagePress ? (
          <Pressable onPress={onManagePress} hitSlop={10}>
            <Text style={styles.link}>{t("billing.manageSubscription")}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.legal}>
        {t("subscriptions.paywallFeatureCancel", { store: storeName })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: 14,
    position: "relative",
  },
  card: {
    borderRadius: 22,
    padding: 20,
    position: "relative",
  },
  glowClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    overflow: "hidden",
  },
  recommendedPill: {
    position: "absolute",
    top: -10,
    right: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: LUX.gold,
    zIndex: 10,
    elevation: 10,
    shadowColor: LUX.goldWarm,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  recommendedText: {
    color: "#0b0f14",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerRow: {
    marginBottom: 18,
  },
  nameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  tierName: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  tagline: {
    fontStyle: "italic",
    fontSize: 13,
    color: LUX.muted,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  price: {
    fontSize: 42,
    fontWeight: "400",
    color: LUX.text,
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  priceSuffix: {
    fontSize: 13,
    color: LUX.muted,
    marginLeft: 6,
  },
  priceHint: {
    fontSize: 12,
    color: LUX.faint,
    marginBottom: 12,
  },
  trialPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 16,
  },
  trialText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  perks: {
    gap: 10,
    marginBottom: 20,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkText: {
    fontSize: 13,
    color: LUX.text,
    opacity: 0.92,
    flex: 1,
  },
  cta: {
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  ctaLabel: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  link: {
    color: LUX.muted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  linkSep: {
    color: LUX.faint,
  },
  legal: {
    fontSize: 11,
    color: LUX.faint,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 320,
    alignSelf: "center",
  },
  stateCard: {
    padding: 20,
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: LUX.surface,
    borderWidth: 1,
    borderColor: LUX.border,
  },
  stateText: {
    color: LUX.muted,
    fontSize: 14,
    textAlign: "center",
  },
  ghostBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: LUX.border,
  },
  ghostBtnText: {
    color: LUX.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
