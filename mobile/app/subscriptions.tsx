import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Modal,
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
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type {
  PurchasesIntroPrice,
  PurchasesPackage,
} from "react-native-purchases";
import {
  fetchEntitlements,
  fetchPersonalizedPath,
  fetchProfile,
  fetchSubscriptionPlans,
  queryKeys,
  staleTimes,
  type ActivePromo,
  type Entitlements,
} from "@garzoni/core";
import GlassCard from "../src/components/ui/GlassCard";
import LoadingSpinner from "../src/components/ui/LoadingSpinner";
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
  rcGetActivePlan,
  rcIsEntitled,
  crossPlatformBlockStore,
  waitForActiveSubscription,
} from "../src/billing/subscriptionRuntime";
import { useAuthSession } from "../src/auth/AuthContext";
import { userIdFromAccessToken } from "../src/auth/jwtClaims";
import { trackEvent } from "../src/lib/analytics";

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

// `name` is the brand tier and stays untranslated; everything else is a locale
// key resolved at render time (see `subscriptions.mobilePaywall.tiers`).
const PLAN_DATA = {
  plus: {
    id: "plus" as const,
    name: "Plus",
    taglineKey: "subscriptions.mobilePaywall.tiers.plusTagline",
    perkKeys: [
      "subscriptions.mobilePaywall.tiers.plusPerk1",
      "subscriptions.mobilePaywall.tiers.plusPerk2",
      "subscriptions.mobilePaywall.tiers.plusPerk3",
    ],
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    taglineKey: "subscriptions.mobilePaywall.tiers.proTagline",
    perkKeys: [
      "subscriptions.mobilePaywall.tiers.proPerk1",
      "subscriptions.mobilePaywall.tiers.proPerk2",
      "subscriptions.mobilePaywall.tiers.proPerk3",
      "subscriptions.mobilePaywall.tiers.proPerk4",
    ],
  },
};

const COMPARE_ROWS: {
  labelKey: string;
  starter: boolean;
  plus: boolean;
  pro: boolean;
}[] = [
  {
    labelKey: "subscriptions.mobilePaywall.compareRows.guidedLessons",
    starter: true,
    plus: true,
    pro: true,
  },
  {
    labelKey: "subscriptions.mobilePaywall.compareRows.streaksXp",
    starter: true,
    plus: true,
    pro: true,
  },
  {
    labelKey: "subscriptions.mobilePaywall.compareRows.personalisedPath",
    starter: false,
    plus: true,
    pro: true,
  },
  {
    labelKey: "subscriptions.mobilePaywall.compareRows.unlimitedCalculators",
    starter: false,
    plus: true,
    pro: true,
  },
  {
    labelKey: "subscriptions.mobilePaywall.compareRows.advancedSimulations",
    starter: false,
    plus: false,
    pro: true,
  },
  {
    labelKey: "subscriptions.mobilePaywall.compareRows.priorityAi",
    starter: false,
    plus: false,
    pro: true,
  },
  {
    labelKey: "subscriptions.mobilePaywall.compareRows.earlyAccess",
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

/** Minimal shape of react-i18next's `t` — avoids importing i18next types here. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** StoreKit `periodUnit` → the locale sub-key used for that unit's copy. */
function introPeriodUnitKey(intro: PurchasesIntroPrice, fallback: string) {
  const unit = String(intro.periodUnit ?? fallback).toUpperCase();
  if (unit === "DAY") return "day";
  if (unit === "WEEK") return "week";
  if (unit === "MONTH") return "month";
  if (unit === "YEAR") return "year";
  return "period";
}

/** Uses StoreKit intro `periodUnit` — avoids showing "1 day" when Apple reports a 1-week trial as WEEK × 1. */
function formatIntroTrialLabel(
  intro: PurchasesIntroPrice,
  t: Translate,
): string {
  const n = intro.periodNumberOfUnits ?? 0;
  const unitKey = introPeriodUnitKey(intro, "DAY");
  const group = n === 1 ? "trialOne" : "trialMany";
  return t(`subscriptions.mobilePaywall.${group}.${unitKey}`, { count: n });
}

/** Format a numeric amount as currency, matching the store's currency code. */
function formatCurrencyAmount(amount: number, currencyCode?: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "USD",
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

/** Trial length in days from StoreKit intro period (WEEK×1 → 7, MONTH×1 → 30). */
function introTrialDays(intro: PurchasesIntroPrice): number {
  const n = intro.periodNumberOfUnits ?? 0;
  const unit = String(intro.periodUnit ?? "DAY").toUpperCase();
  if (unit === "WEEK") return n * 7;
  if (unit === "MONTH") return n * 30;
  if (unit === "YEAR") return n * 365;
  return n;
}

/** Blinkist-style trial timeline: shows exactly what happens on which day so
 * starting a trial feels safe (reminder before charge is real — CIO
 * send_trial_ending_reminder fires 2 days before trial end). */
function TrialTimeline({ intro }: { intro: PurchasesIntroPrice }) {
  const { t } = useTranslation("common");
  const days = introTrialDays(intro);
  if (days < 3) return null;
  const rows = [
    {
      icon: "lock-open-variant-outline",
      label: t("subscriptions.trialTimeline.today"),
    },
    {
      icon: "bell-ring-outline",
      label: t("subscriptions.trialTimeline.reminder", { day: days - 2 }),
    },
    {
      icon: "star-circle-outline",
      label: t("subscriptions.trialTimeline.charged", { day: days }),
    },
  ] as const;
  return (
    <View style={styles.trialTimeline}>
      {rows.map((row, i) => (
        <View key={row.icon} style={styles.trialTimelineRow}>
          <MaterialCommunityIcons
            name={row.icon}
            size={15}
            color={i === 0 ? D.goldWarm : D.muted}
          />
          <Text
            style={[
              styles.trialTimelineText,
              i === 0 && styles.trialTimelineTextNow,
            ]}
          >
            {row.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Label for a paid intro offer (store-configured discount), e.g. "first year" or "first 3 months". */
function formatIntroOfferLabel(
  intro: PurchasesIntroPrice,
  t: Translate,
): string {
  const n = (intro.periodNumberOfUnits ?? 0) * Math.max(intro.cycles ?? 1, 1);
  const unitKey = introPeriodUnitKey(intro, "MONTH");
  const group = n <= 1 ? "introFirstOne" : "introFirstMany";
  return t(`subscriptions.mobilePaywall.${group}.${unitKey}`, { count: n });
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
  const { t } = useTranslation("common");
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
              {k === "yearly"
                ? t("subscriptions.mobilePaywall.cycleYearly")
                : t("subscriptions.mobilePaywall.cycleMonthly")}
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

/** Format a promo end date as "31 August" using the device locale. */
function formatPromoEndDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Prominent, top-of-page promo banner so the active discount is obvious on
 * arrival — not only once the user reaches a plan card's store-intro price. */
function PromoHero({ promo }: { promo: ActivePromo }) {
  const { t } = useTranslation("common");
  return (
    <View style={styles.promoHero}>
      <View style={styles.promoHeroIcon}>
        <MaterialCommunityIcons name="sale" size={22} color={D.bg} />
      </View>
      <View style={styles.promoHeroText}>
        <Text style={styles.promoHeroTitle}>
          {t("subscriptions.promoBanner", { percent: promo.percent_off })}
        </Text>
        <Text style={styles.promoHeroSub}>
          {t("subscriptions.promoBannerEnds", {
            date: formatPromoEndDate(promo.ends_on),
          })}
        </Text>
      </View>
    </View>
  );
}

function TierCard({
  plan,
  pkg,
  cycle,
  isCurrent,
  loading,
  recommended,
  onPress,
}: {
  plan: (typeof PLAN_DATA)[Tier];
  pkg: PurchasesPackage | null;
  cycle: Cycle;
  isCurrent: boolean;
  loading: boolean;
  recommended: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation("common");
  const isPro = plan.id === "pro";
  const accent = isPro ? D.goldWarm : D.primaryBright;
  // The amount the store actually charges, formatted by the store. Used wherever
  // a real charge is quoted: the struck-through original, and the "then X / year"
  // line under an intro offer.
  const fullPriceString = pkg?.product.priceString ?? "—";
  // A yearly package carries the *annual* total in priceString, but the headline
  // label underneath reads "/ month, billed annually" — rendering it raw stated
  // the price at 12x and contradicted the per-week figure just below. This is the
  // monthly equivalent, and it belongs only next to a per-month label. Quoting it
  // against "/ year" understates the charge by the same factor in the other
  // direction, which is what happened when this was a single shared variable.
  const price =
    cycle === "yearly" && pkg && pkg.product.price > 0
      ? formatCurrencyAmount(pkg.product.price / 12, pkg.product.currencyCode)
      : fullPriceString;
  const per =
    cycle === "yearly"
      ? t("subscriptions.mobilePaywall.perMonthBilledAnnually")
      : t("subscriptions.mobilePaywall.perMonth");
  const intro = pkg?.product.introPrice;
  const showTrial = Boolean(intro && intro.price === 0);
  // Store-configured discounted intro price (e.g. 60%-off promo) — free trials excluded.
  const paidIntro = intro && intro.price > 0 ? intro : null;
  const discountPct =
    paidIntro && pkg && pkg.product.price > 0
      ? Math.round((1 - paidIntro.price / pkg.product.price) * 100)
      : null;
  const disabled = !pkg || isCurrent;
  const ctaLabel = isCurrent
    ? t("subscriptions.mobilePaywall.ctaCurrentPlan")
    : cycle === "yearly"
      ? t("subscriptions.mobilePaywall.ctaStartAnnual", { plan: plan.name })
      : t("subscriptions.mobilePaywall.ctaStart", { plan: plan.name });
  // Per-week contrast framing under the yearly price (annual total / 52).
  const weeklyLabel =
    cycle === "yearly" && pkg && pkg.product.price > 0
      ? t("subscriptions.perWeek", {
          price: formatCurrencyAmount(
            pkg.product.price / 52,
            pkg.product.currencyCode,
          ),
        })
      : null;

  return (
    <View
      style={[
        styles.tierCard,
        isPro && styles.tierCardPro,
        recommended && styles.tierCardRecommended,
      ]}
    >
      {/* Recommended pill */}
      {recommended && (
        <View style={styles.recommendedWrap}>
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>
              {t("subscriptions.mobilePaywall.recommended")}
            </Text>
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
          {t(plan.taglineKey)}
        </Text>
        {paidIntro && discountPct != null && discountPct > 0 && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>{discountPct}% OFF</Text>
          </View>
        )}
        {showTrial && intro && (
          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>
              {formatIntroTrialLabel(intro, t)}
            </Text>
          </View>
        )}
        {isCurrent && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>
              {t("subscriptions.mobilePaywall.currentBadge")}
            </Text>
          </View>
        )}
      </View>

      {/* Price */}
      <View style={styles.priceRow}>
        {/* Struck-through original sits beside the intro total, so both must be
            the real charge for the same period — not a monthly equivalent. */}
        {paidIntro && <Text style={styles.priceStrike}>{fullPriceString}</Text>}
        <Text style={[styles.price, { fontFamily: DISPLAY_FONT }]}>
          {paidIntro ? paidIntro.priceString : price}
        </Text>
      </View>
      {paidIntro ? (
        <Text style={[styles.pricePer, { color: accent }]}>
          {(() => {
            const params = {
              period: formatIntroOfferLabel(paidIntro, t),
              // What they pay once the intro ends, for the period the suffix
              // names — the annual total on a yearly plan, never the /12.
              price: fullPriceString,
              suffix:
                cycle === "yearly"
                  ? t("subscriptions.mobilePaywall.thenPerYear")
                  : t("subscriptions.mobilePaywall.thenPerMonth"),
            };
            return discountPct != null && discountPct > 0
              ? t("subscriptions.mobilePaywall.introOfferDiscount", {
                  ...params,
                  percent: discountPct,
                })
              : t("subscriptions.mobilePaywall.introOffer", params);
          })()}
        </Text>
      ) : (
        <Text style={styles.pricePer}>{per}</Text>
      )}
      {weeklyLabel && !paidIntro && (
        <Text style={styles.priceWeek}>{weeklyLabel}</Text>
      )}

      {/* Perks */}
      <View style={styles.perkList}>
        {plan.perkKeys.map((perkKey) => (
          <View key={perkKey} style={styles.perkRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={15}
              color={accent}
            />
            <Text style={styles.perkText}>{t(perkKey)}</Text>
          </View>
        ))}
      </View>

      {/* Trial timeline (free trials only) — reduce risk before the ask */}
      {showTrial && intro && !isCurrent && <TrialTimeline intro={intro} />}

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
          <LoadingSpinner size="sm" color={isPro ? D.bg : "#fff"} />
        ) : (
          <Text style={[styles.tierCtaText, { color: isPro ? D.bg : "#fff" }]}>
            {ctaLabel}
            {!isCurrent ? "  ›" : ""}
          </Text>
        )}
      </Pressable>
      {!isCurrent && pkg && (
        <Text style={styles.ctaSubtitle}>
          {t("subscriptions.noCommitment")}
        </Text>
      )}
      {!pkg && !loading && !isCurrent && (
        <Text style={styles.pkgUnavailableText}>
          {t("subscriptions.mobilePaywall.pricingUnavailable")}
        </Text>
      )}
    </View>
  );
}

function CompareMatrix() {
  const { t } = useTranslation("common");
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
        <Text style={styles.compareToggleLabel}>
          {t("subscriptions.mobilePaywall.compareToggle")}
        </Text>
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
            <Text style={[styles.compareColLabel, { flex: 2 }]}>
              {t("subscriptions.mobilePaywall.compareFeature")}
            </Text>
            <Text style={styles.compareColLabel}>
              {t("subscriptions.mobilePaywall.compareFree")}
            </Text>
            <Text style={styles.compareColLabel}>
              {t("subscriptions.mobilePaywall.comparePlus")}
            </Text>
            <Text style={[styles.compareColLabel, { color: D.goldWarm }]}>
              {t("subscriptions.mobilePaywall.comparePro")}
            </Text>
          </View>
          {COMPARE_ROWS.map((row, i) => (
            <View
              key={row.labelKey}
              style={[
                styles.compareRow,
                i < COMPARE_ROWS.length - 1 && styles.compareRowBorder,
              ]}
            >
              <Text style={[styles.compareFeature, { flex: 2 }]}>
                {t(row.labelKey)}
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
  const { t } = useTranslation("common");
  const planName = plan === "plus" ? "Plus" : "Pro";
  const label =
    plan === "starter"
      ? t("subscriptions.mobilePaywall.statusFreePlan")
      : interval
        ? t("subscriptions.mobilePaywall.statusInterval", {
            plan: planName,
            interval:
              interval === "yearly"
                ? t("subscriptions.mobilePaywall.cycleYearly")
                : t("subscriptions.mobilePaywall.cycleMonthly"),
          })
        : planName;
  const dotColor =
    plan === "pro" ? D.goldWarm : plan === "plus" ? D.primaryBright : D.faint;

  return (
    <View style={styles.statusChipWrap}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={styles.statusChipText}>
        {plan === "starter"
          ? t("subscriptions.mobilePaywall.statusOnThe")
          : t("subscriptions.mobilePaywall.statusOn")}
        <Text style={{ color: D.text, fontWeight: "500" }}>{label}</Text>
        {plan !== "starter" &&
          t("subscriptions.mobilePaywall.statusPlanSuffix")}
      </Text>
    </View>
  );
}

function UtilityLinks({
  onRestore,
  onManageStore,
  onRedeemCode,
}: {
  onRestore: () => void;
  onManageStore: () => void;
  onRedeemCode: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <View style={styles.utilityWrap}>
      <Pressable onPress={onRestore}>
        <Text style={styles.utilityLink}>
          {t("subscriptions.mobilePaywall.restorePurchases")}
        </Text>
      </Pressable>
      <Text style={styles.utilityDot}>·</Text>
      <Pressable onPress={onManageStore}>
        <Text style={styles.utilityLink}>
          {t("subscriptions.mobilePaywall.manageSubscription")}
        </Text>
      </Pressable>
      {Platform.OS === "ios" && (
        <>
          <Text style={styles.utilityDot}>·</Text>
          <Pressable onPress={onRedeemCode}>
            <Text style={styles.utilityLink}>
              {t("subscriptions.mobilePaywall.redeemCode")}
            </Text>
          </Pressable>
        </>
      )}
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
  const { t } = useTranslation("common");
  const tierLabel = tier === "pro" ? "Pro" : tier === "plus" ? "Plus" : null;
  const accent = tier === "pro" ? D.goldWarm : D.primaryBright;

  return (
    <View style={styles.overlayBackdrop} pointerEvents="auto">
      <View style={styles.overlayCard}>
        {step === "syncing" && (
          <>
            <LoadingSpinner size="lg" color={accent} />
            <Text style={styles.overlayTitle}>
              {tierLabel
                ? t("subscriptions.mobilePaywall.overlay.activatingTier", {
                    tier: tierLabel,
                  })
                : t("subscriptions.mobilePaywall.overlay.activating")}
            </Text>
            <Text style={styles.overlayBody}>
              {t("subscriptions.mobilePaywall.overlay.activatingBody")}
            </Text>
          </>
        )}

        {step === "success" && (
          <>
            <View style={[styles.overlayCheck, { backgroundColor: accent }]}>
              <MaterialCommunityIcons name="check" size={36} color="#fff" />
            </View>
            <Text style={[styles.overlayTitle, { color: accent }]}>
              {t("subscriptions.mobilePaywall.overlay.successTitle")}
            </Text>
            <Text style={styles.overlayBody}>
              {tierLabel
                ? t("subscriptions.mobilePaywall.overlay.successTier", {
                    tier: tierLabel,
                  })
                : t("subscriptions.mobilePaywall.overlay.success")}
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
            <Text style={styles.overlayTitle}>
              {t("subscriptions.mobilePaywall.overlay.errorTitle")}
            </Text>
            <Text style={styles.overlayBody}>
              {error ?? t("subscriptions.mobilePaywall.overlay.errorBody")}
            </Text>
            <View style={styles.overlayBtnRow}>
              <Pressable
                style={[styles.overlayBtn, styles.overlayBtnPrimary]}
                onPress={onRetry}
              >
                <Text style={styles.overlayBtnPrimaryText}>
                  {t("subscriptions.mobilePaywall.overlay.retry")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.overlayBtn, styles.overlayBtnSecondary]}
                onPress={onDismiss}
              >
                <Text style={styles.overlayBtnSecondaryText}>
                  {t("subscriptions.mobilePaywall.overlay.close")}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Exit-intent bottom sheet ────────────────────────────────────────────────

function ExitIntentSheet({
  visible,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="slide"
      onRequestClose={onDecline}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onDecline}>
        <Pressable
          style={styles.sheetCard}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {t("subscriptions.exitIntent.title")}
          </Text>
          <Text style={styles.sheetBody}>
            {t("subscriptions.exitIntent.body")}
          </Text>
          <Pressable style={styles.sheetPrimary} onPress={onAccept}>
            <Text style={styles.sheetPrimaryText}>
              {t("subscriptions.exitIntent.tryMonthly")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.sheetSecondary}
            onPress={onDecline}
            hitSlop={8}
          >
            <Text style={styles.sheetSecondaryText}>
              {t("subscriptions.exitIntent.noThanks")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SubscriptionsScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const { top: topInset } = useSafeAreaInsets();
  const { accessToken } = useAuthSession();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    onboarding?: string | string[];
    recommended?: string | string[];
    goal?: string | string[];
    from?: string | string[];
  }>();

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;
  const onboardingParam = Array.isArray(params.onboarding)
    ? params.onboarding[0]
    : params.onboarding;
  const legacyPaywall = String(onboardingParam ?? "").toLowerCase() === "true";
  const isPaywall =
    String(modeParam ?? "").toLowerCase() === "paywall" || legacyPaywall;

  // Personalized paywall inputs from the plan-ready segue.
  const recommendedParam = Array.isArray(params.recommended)
    ? params.recommended[0]
    : params.recommended;
  const recommendedTier: Tier =
    String(recommendedParam ?? "").toLowerCase() === "plus"
      ? "plus"
      : String(recommendedParam ?? "").toLowerCase() === "pro"
        ? "pro"
        : "pro"; // default preserves the pre-personalization behavior (Pro highlighted)
  const goalParam = Array.isArray(params.goal) ? params.goal[0] : params.goal;
  const goalLabel = goalParam ? String(goalParam) : null;

  const rcNative = useMemo(() => getRevenueCatPurchases() !== null, []);

  // Paywall visibility — without this, mobile paywall drop-off is invisible
  // in the funnel (web fires pricing_view from SubscriptionPlansPage).
  const pricingViewSentRef = useRef(false);
  useEffect(() => {
    if (pricingViewSentRef.current) return;
    pricingViewSentRef.current = true;
    trackEvent("pricing_view", {
      source: isPaywall ? "onboarding_paywall" : "in_app",
      // Paywall placement experiment arm (3.5): "post_first_lesson" when the
      // paywall was deferred until after the first lesson, else "onboarding".
      placement:
        fromParam === "post_first_lesson" ? "post_first_lesson" : "onboarding",
    });
  }, [isPaywall, fromParam]);

  const [cycle, setCycle] = useState<Cycle>("yearly");
  const [exitIntentVisible, setExitIntentVisible] = useState(false);
  const exitIntentShownRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const plansYRef = useRef(0);
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

  // Active promo (e.g. summer 60% off). Public/no-auth so it also renders on
  // the onboarding paywall before login. Drives the top-of-page PromoHero.
  const plansQ = useQuery({
    queryKey: ["subscription-plans-promo"],
    queryFn: () => fetchSubscriptionPlans().then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const activePromo = plansQ.data?.promo ?? null;

  const currentPlan = planFromEntitlements(entQ.data);
  const currentInterval = intervalFromEntitlements(entQ.data);

  // RevenueCat appUserID must be the numeric Django PK (backend silently
  // skips non-digit ids). Prefer profile.user.id; fall back to the JWT
  // user_id claim so an authenticated user is never left anonymous in RC.
  const backendUserId =
    profileQ.data?.user?.id?.toString() ?? userIdFromAccessToken(accessToken);

  const loadOfferings = useCallback(async () => {
    if (!rcNative) return;
    const userId = backendUserId;
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
  }, [backendUserId, rcNative]);

  useEffect(() => {
    if (!rcNative) return;
    // When unauthenticated (onboarding paywall, Apple review), load immediately with anonymous RC user.
    // When authenticated, wait for profile so RC is configured with the correct user ID.
    if (accessToken && !profileQ.isFetched) return;
    void loadOfferings();
  }, [loadOfferings, accessToken, profileQ.isFetched, rcNative]);

  const onPurchase = useCallback(
    async (tier: Tier, pkg: PurchasesPackage) => {
      const rc = getRevenueCatPurchases();
      if (!rc) return;
      setPurchasingTier(tier);
      setPurchaseError(null);
      trackEvent("upgrade_click", {
        tier,
        package: pkg.identifier,
        source: isPaywall ? "onboarding_paywall" : "in_app",
      });
      try {
        // 0. Identity MUST be the numeric Django PK before purchasing, so the
        //    receipt + webhook are attributed to the user the backend grants by
        //    (str(user.pk)). Never purchase under an anonymous RC session.
        const userId = backendUserId;
        if (accessToken && !userId) {
          // Authenticated but no resolvable PK — an anonymous purchase here
          // would be unrecoverable by the backend. Refuse instead.
          setPurchaseError(
            t("subscriptions.mobilePaywall.errors.identityMissing"),
          );
          setPurchaseStep("error");
          return;
        }
        if (configureRevenueCatForUser(userId) && userId) {
          await identifyRevenueCatUser(userId);
        }
        if (__DEV__) {
          const appUserId = await rc.Purchases.getAppUserID().catch(() => "?");
          console.log(
            `[Garzoni] pre-purchase identity → profile.user.id=${userId ?? "MISSING"} rcAppUserID=${appUserId}`,
          );
        }

        // 0b. Clash guard — if this account is already subscribed through a
        //     different store (commonly the web/Stripe), block: a purchase here
        //     would double-charge because Apple/Google can't see that sub.
        //     Same-store upgrades (Plus→Pro, cycle switch) fall through and are
        //     handled natively. Soft-fail on lookup error → allow the purchase.
        try {
          const existing = await rc.Purchases.getCustomerInfo();
          const otherStore = crossPlatformBlockStore(existing);
          if (otherStore) {
            setPurchaseError(
              t("subscriptions.mobilePaywall.errors.crossPlatform", {
                store: otherStore,
              }),
            );
            setPurchasingTier(null);
            setPurchaseStep("error");
            return;
          }
        } catch {
          /* lookup failed — don't block a legitimate first purchase */
        }

        // 1. Apple's native purchase flow (RC SDK shows the system overlay)
        await rc.Purchases.purchasePackage(pkg);

        // 2. Backend sync — show our own progress UI now
        setPurchaseStep("syncing");
        const entitlements = await waitForActiveSubscription(queryClient);

        if (entitlements && planRank(entitlements.plan) >= 1) {
          setPurchaseStep("success");
          trackEvent("checkout_completed", {
            tier,
            package: pkg.identifier,
            store: "revenuecat",
          });
          // Warm the personalized-path cache during the success animation so
          // the user lands on a loaded screen instead of a spinner.
          void queryClient.prefetchQuery({
            queryKey: queryKeys.personalizedPath(),
            queryFn: fetchPersonalizedPath,
          });
          setTimeout(() => {
            setPurchaseStep("idle");
            setPurchasingTier(null);
            if (isPaywall) router.replace("/(tabs)");
            else router.back();
          }, 1400);
        } else {
          // Apple confirmed but backend didn't catch up — surface a retry
          setPurchaseError(t("subscriptions.mobilePaywall.errors.backendLag"));
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
          trackEvent("checkout_expired", {
            tier,
            package: pkg.identifier,
            store: "revenuecat",
            reason: "user_cancelled",
          });
          return;
        }
        setPurchaseError(
          err.message ?? t("subscriptions.mobilePaywall.errors.generic"),
        );
        setPurchaseStep("error");
        trackEvent("checkout_failed", {
          tier,
          package: pkg.identifier,
          store: "revenuecat",
          code: err.code ?? "unknown",
        });
      }
    },
    [isPaywall, queryClient, backendUserId, accessToken, t],
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
        void queryClient.prefetchQuery({
          queryKey: queryKeys.personalizedPath(),
          queryFn: fetchPersonalizedPath,
        });
        setTimeout(() => {
          setPurchaseStep("idle");
          setPurchasingTier(null);
          if (isPaywall) router.replace("/(tabs)");
          else router.back();
        }, 1400);
      } else {
        setPurchaseError(t("subscriptions.mobilePaywall.errors.retryNoLuck"));
        setPurchaseStep("error");
      }
    } catch {
      setPurchaseError(t("subscriptions.mobilePaywall.errors.retryFailed"));
      setPurchaseStep("error");
    }
  }, [isPaywall, queryClient, t]);

  const dismissPurchaseOverlay = useCallback(() => {
    setPurchaseStep("idle");
    setPurchasingTier(null);
    setPurchaseError(null);
  }, []);

  // Exit-intent: intercept the first "Skip for now" per paywall visit with a
  // monthly-plan offer before dismissing to home.
  const handleSkipPress = useCallback(() => {
    if (!exitIntentShownRef.current) {
      exitIntentShownRef.current = true;
      trackEvent("exit_intent_shown", {
        source: isPaywall ? "onboarding_paywall" : "in_app",
      });
      setExitIntentVisible(true);
      return;
    }
    trackEvent("cta_click", { cta: "paywall_skip" });
    router.replace("/(tabs)");
  }, [isPaywall]);

  const handleExitIntentAccept = useCallback(() => {
    trackEvent("exit_intent_accepted", {});
    setExitIntentVisible(false);
    setCycle("monthly");
    // Let the toggle re-render, then bring the plans into view.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: plansYRef.current, animated: true });
    });
  }, []);

  const handleExitIntentDecline = useCallback(() => {
    trackEvent("exit_intent_declined", {});
    setExitIntentVisible(false);
    router.replace("/(tabs)");
  }, []);

  const onRestore = useCallback(async () => {
    const rc = getRevenueCatPurchases();
    if (!rc) return;
    setRestoring(true);
    try {
      // Ensure RC is logged in as the numeric PK BEFORE restoring, so the
      // restored entitlement lands on the subscriber the backend reconcile
      // queries (str(user.pk)). Otherwise restore attaches to an anonymous
      // session and the grant never reaches the account.
      const userId = backendUserId;
      if (configureRevenueCatForUser(userId) && userId) {
        await identifyRevenueCatUser(userId);
      }
      await rc.Purchases.restorePurchases();
      const entitlements = await waitForActiveSubscription(queryClient, {
        maxAttempts: 3,
        delayMs: 1000,
      });
      if (entitlements && planRank(entitlements.plan) >= 1) {
        Alert.alert(
          t("subscriptions.mobilePaywall.restore.restoredTitle"),
          t("subscriptions.mobilePaywall.restore.restoredBody", {
            tier: entitlements.plan === "pro" ? "Pro" : "Plus",
          }),
        );
      } else {
        Alert.alert(
          t("subscriptions.mobilePaywall.restore.nothingTitle"),
          t("subscriptions.mobilePaywall.restore.nothingBody"),
        );
      }
    } catch (e: unknown) {
      Alert.alert(
        t("subscriptions.mobilePaywall.restore.failedTitle"),
        (e as { message?: string }).message ??
          t("subscriptions.mobilePaywall.errors.generic"),
      );
    } finally {
      setRestoring(false);
    }
  }, [queryClient, backendUserId, t]);

  const onManageStore = useCallback(async () => {
    const url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions";
    await Linking.openURL(url).catch(() => null);
  }, []);

  const onRedeemCode = useCallback(async () => {
    const rc = getRevenueCatPurchases();
    if (!rc) return;
    const userId = backendUserId;
    if (!configureRevenueCatForUser(userId)) return;
    if (userId) {
      await identifyRevenueCatUser(userId);
    }

    setPurchaseStep("syncing");
    setPurchasingTier(null);
    setPurchaseError(null);

    try {
      await rc.Purchases.presentCodeRedemptionSheet();
    } catch {
      setPurchaseStep("idle");
      return;
    }

    // Redemption can finish slightly after the sheet dismisses — poll RC until entitled or timeout.
    const pollMs = 1500;
    const maxPolls = 24;
    let detectedTier: Tier | null = null;

    for (let i = 0; i < maxPolls; i++) {
      try {
        await rc.Purchases.syncPurchasesForResult();
      } catch {
        /* ignore transient sync errors */
      }
      try {
        const ci = await rc.Purchases.getCustomerInfo();
        if (rcIsEntitled(ci)) {
          const p = rcGetActivePlan(ci);
          if (p === "plus" || p === "pro") {
            detectedTier = p;
            setPurchasingTier(p);
          }
          break;
        }
      } catch {
        /* ignore */
      }
      await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
    }

    const entitlements = await waitForActiveSubscription(queryClient, {
      maxAttempts: 8,
      delayMs: 1000,
    });

    const plan = entitlements?.plan;
    const navigate = () => {
      setPurchaseStep("idle");
      setPurchasingTier(null);
      if (isPaywall) router.replace("/(tabs)");
      else router.back();
    };

    if (planRank(plan) >= 1 && (plan === "plus" || plan === "pro")) {
      setPurchasingTier(plan);
      setPurchaseStep("success");
      setTimeout(navigate, 1400);
    } else if (detectedTier) {
      // RC confirmed entitlement but backend webhook hasn't fired yet — navigate
      // immediately using RC as source of truth; backend will sync via webhook.
      setPurchasingTier(detectedTier);
      setPurchaseStep("success");
      setTimeout(navigate, 1400);
    } else {
      setPurchaseError(t("subscriptions.mobilePaywall.errors.redeemPending"));
      setPurchaseStep("error");
    }
  }, [isPaywall, backendUserId, queryClient, t]);

  const plusPkg = pickPackage(plusPkgs ?? undefined, cycle);
  const proPkg = pickPackage(proPkgs ?? undefined, cycle);

  // The banner comes from the backend promo window; the actual discount only
  // exists if the store has a paid introductory offer on the product. Those are
  // configured per-store and per-product, so the two can disagree — and a
  // "60% off" banner over full-price cards is both a support burden and an
  // App Review 3.1.1 misleading-pricing risk. Show it only when a real
  // discounted intro price is visible on at least one package.
  const storePromoLive =
    (plusPkg?.product.introPrice?.price ?? 0) > 0 ||
    (proPkg?.product.introPrice?.price ?? 0) > 0;

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
          title:
            isPaywall || currentPlan === "starter"
              ? t("subscriptions.mobilePaywall.titleChoose")
              : t("subscriptions.mobilePaywall.titleManage"),
          headerShown: !isPaywall,
          headerStyle: { backgroundColor: D.bg },
          gestureEnabled: !isPaywall,
        }}
      />
      <View style={styles.root}>
        <AmbientGlow />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            isPaywall && { paddingTop: topInset + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContent}>
            {/* Eyebrow */}
            <Text style={styles.eyebrow}>
              {t("subscriptions.mobilePaywall.eyebrow")}
            </Text>

            {/* Editorial headline — goal-referencing in the personalized paywall */}
            {isPaywall && goalLabel ? (
              <Text style={styles.headline}>
                {t("subscriptions.paywallHeadlineGoal", { goal: goalLabel })}
              </Text>
            ) : (
              <Text style={styles.headline}>
                {t("subscriptions.mobilePaywall.headlineLead")}
                <Text
                  style={[
                    styles.headlineEmphasis,
                    { fontFamily: DISPLAY_FONT },
                  ]}
                >
                  {t("subscriptions.mobilePaywall.headlineEmphasis")}
                </Text>
                {t("subscriptions.mobilePaywall.headlineTail")}
              </Text>
            )}

            {/* Status chip */}
            <StatusChip plan={currentPlan} interval={currentInterval} />

            {/* Active promo — prominent, above the plans so the discount is
                obvious the moment the page loads. */}
            {activePromo && currentPlan === "starter" && storePromoLive && (
              <PromoHero promo={activePromo} />
            )}

            {/* No-RC warning */}
            {!rcNative ? (
              <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
                <Text style={[styles.cardTitle, { color: c.text }]}>
                  {t("subscriptions.mobilePaywall.rcUnavailableTitle")}
                </Text>
                <Text style={[styles.cardBody, { color: c.textMuted }]}>
                  {t("subscriptions.mobilePaywall.rcUnavailableBody")}
                </Text>
              </GlassCard>
            ) : (
              <>
                {/* Cycle toggle */}
                <View
                  style={styles.cycleContainer}
                  onLayout={(e) => {
                    plansYRef.current = e.nativeEvent.layout.y;
                  }}
                >
                  <CycleToggle
                    value={cycle}
                    onChange={setCycle}
                    savingsPct={savingsPct}
                  />
                </View>

                {/* Tier cards */}
                {loading ? (
                  <GlassCard padding="lg" style={{ marginBottom: spacing.md }}>
                    <LoadingSpinner size="lg" color={D.primaryBright} />
                  </GlassCard>
                ) : (
                  <>
                    {(recommendedTier === "pro"
                      ? (["pro", "plus"] as const)
                      : (["plus", "pro"] as const)
                    ).map((tier) => {
                      const pkg = tier === "pro" ? proPkg : plusPkg;
                      return (
                        <TierCard
                          key={tier}
                          plan={PLAN_DATA[tier]}
                          pkg={pkg}
                          cycle={cycle}
                          isCurrent={
                            currentPlan === tier && currentInterval === cycle
                          }
                          loading={purchasingTier === tier}
                          recommended={tier === recommendedTier}
                          onPress={() => pkg && void onPurchase(tier, pkg)}
                        />
                      );
                    })}
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
                onRedeemCode={() => void onRedeemCode()}
              />
            )}

            {/* Skip for now — own row so it's reachable without scrolling */}
            {isPaywall && (
              <View style={styles.skipWrap}>
                <Pressable
                  onPress={handleSkipPress}
                  accessibilityRole="button"
                  hitSlop={12}
                >
                  <Text style={styles.skipText}>
                    {t("subscriptions.mobilePaywall.skipForNow")}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Paywall footer: restore + redeem (Apple guideline 3.1.1) */}
            {isPaywall && (
              <View style={styles.paywallFooter}>
                <Pressable
                  onPress={() => void onRestore()}
                  accessibilityRole="button"
                >
                  <Text style={styles.utilityLink}>
                    {t("subscriptions.mobilePaywall.restorePurchases")}
                  </Text>
                </Pressable>
                {Platform.OS === "ios" && (
                  <>
                    <Text style={styles.utilityDot}>·</Text>
                    <Pressable
                      onPress={() => void onRedeemCode()}
                      accessibilityRole="button"
                    >
                      <Text style={styles.utilityLink}>
                        {t("subscriptions.mobilePaywall.redeemCode")}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            {/* Legal — iOS only (Apple IAP copy) */}
            {Platform.OS === "ios" && (
              <>
                <Text style={styles.legal}>
                  {t("subscriptions.mobilePaywall.legalIos")}
                </Text>
                <View style={styles.legalLinks}>
                  <Pressable
                    onPress={() => router.push("/legal/terms")}
                    accessibilityRole="link"
                  >
                    <Text style={styles.legalLink}>
                      {t("subscriptions.mobilePaywall.termsOfUse")}
                    </Text>
                  </Pressable>
                  <Text style={styles.utilityDot}>·</Text>
                  <Pressable
                    onPress={() => router.push("/legal/privacy")}
                    accessibilityRole="link"
                  >
                    <Text style={styles.legalLink}>
                      {t("subscriptions.mobilePaywall.privacyPolicy")}
                    </Text>
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

        {/* Exit-intent sheet on paywall skip */}
        <ExitIntentSheet
          visible={exitIntentVisible}
          onAccept={handleExitIntentAccept}
          onDecline={handleExitIntentDecline}
        />

        {/* Restore in-progress overlay */}
        {restoring && (
          <View style={styles.overlayBackdrop} pointerEvents="auto">
            <View style={styles.overlayCard}>
              <LoadingSpinner size="lg" color={D.primaryBright} />
              <Text style={styles.overlayTitle}>
                {t("subscriptions.mobilePaywall.overlay.restoringTitle")}
              </Text>
              <Text style={styles.overlayBody}>
                {t("subscriptions.mobilePaywall.overlay.restoringBody")}
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

  // Promo hero
  promoHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    backgroundColor: "rgba(230,200,122,0.12)",
    borderWidth: 1,
    borderColor: "rgba(230,200,122,0.5)",
    marginBottom: 22,
  },
  promoHeroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: D.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: D.goldWarm,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  promoHeroText: {
    flex: 1,
    gap: 2,
  },
  promoHeroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: D.goldWarm,
    letterSpacing: -0.2,
  },
  promoHeroSub: {
    fontSize: 12,
    fontWeight: "500",
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
    borderRadius: 20,
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
  tierCardRecommended: {
    borderWidth: 2,
    borderColor: D.primaryBright,
    shadowOpacity: 0.4,
    // Android ignores shadowOpacity; raise elevation so the recommended tier
    // still visibly lifts above the others.
    elevation: 10,
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
  promoBadge: {
    alignSelf: "flex-start",
    marginLeft: 16,
    marginTop: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: D.gold,
  },
  promoBadgeText: {
    fontSize: typography.xs,
    fontWeight: "800",
    color: D.bg,
    letterSpacing: 0.6,
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
  trialTimeline: {
    marginHorizontal: 16,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(230,200,122,0.06)",
    gap: 6,
  },
  trialTimelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trialTimelineText: {
    fontSize: typography.xs,
    color: D.muted,
    flexShrink: 1,
  },
  trialTimelineTextNow: {
    color: D.goldWarm,
    fontWeight: "700",
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
  priceStrike: {
    fontSize: 20,
    color: D.faint,
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  pricePer: {
    fontSize: 12,
    color: D.faint,
    marginBottom: spacing.lg,
  },
  priceWeek: {
    fontSize: 12,
    fontWeight: "600",
    color: D.muted,
    marginTop: -10,
    marginBottom: spacing.lg,
  },
  ctaSubtitle: {
    fontSize: 12,
    color: D.faint,
    textAlign: "center",
    marginTop: 8,
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
    fontSize: typography.base,
    color: "rgba(229,231,235,0.55)",
    fontWeight: "500",
    textDecorationLine: "underline",
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

  // ── Exit-intent sheet ────────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(11,15,20,0.72)",
  },
  sheetCard: {
    backgroundColor: D.surfaceRaised,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: D.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    alignItems: "center",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: D.ghost,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: D.text,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  sheetBody: {
    fontSize: 14,
    color: D.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  sheetPrimary: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    backgroundColor: D.primaryBright,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  sheetSecondary: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  sheetSecondaryText: {
    color: D.muted,
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});
