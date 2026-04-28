import React from "react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "components/ui";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import { FEATURE_COPY } from "services/entitlementsService";

const PLAN_DETAILS_KEYS: Record<string, Record<string, string>> = {
  starter: {
    daily_limits: "subscriptions.perDay",
    hints: "subscriptions.perDay",
    streak_repair: "billing.notAvailable",
    downloads: "subscriptions.perDay",
    analytics: "billing.notAvailable",
    ai_tutor: "subscriptions.perDay",
    personalized_path: "subscriptions.notIncluded",
  },
  plus: {
    daily_limits: "subscriptions.unlimited",
    hints: "subscriptions.unlimited",
    streak_repair: "subscriptions.perDay",
    downloads: "subscriptions.unlimited",
    analytics: "subscriptions.included",
    ai_tutor: "subscriptions.perDay",
    personalized_path: "subscriptions.included",
  },
  pro: {
    daily_limits: "subscriptions.unlimited",
    hints: "subscriptions.unlimited",
    streak_repair: "subscriptions.perDay",
    downloads: "subscriptions.unlimited",
    analytics: "subscriptions.included",
    ai_tutor: "subscriptions.perDay",
    personalized_path: "subscriptions.included",
  },
};
const PLAN_COUNTS: Record<string, Record<string, number>> = {
  starter: { daily_limits: 3, hints: 2, downloads: 1, ai_tutor: 5 },
  plus: { streak_repair: 1, ai_tutor: 50 },
  pro: { streak_repair: 1, ai_tutor: 200 },
};

type EntitlementsPayload = {
  plan?: string;
  label?: string;
  features?: Record<string, { enabled?: boolean; description?: string }>;
};

type FeatureKey = keyof typeof FEATURE_COPY;

function getPlanDisplayValue(
  plan: string,
  featureKey: string,
  t: (key: string, opts?: { count?: number }) => string
): string {
  const key = PLAN_DETAILS_KEYS[plan]?.[featureKey];
  if (!key || typeof key !== "string") return "";
  if (key === "subscriptions.perDay") {
    const count = PLAN_COUNTS[plan]?.[featureKey] ?? 0;
    return t("subscriptions.perDay", { count });
  }
  return t(key);
}

const FeatureRow = ({
  featureKey,
  entitlements,
}: {
  featureKey: FeatureKey;
  entitlements?: EntitlementsPayload;
}) => {
  const { t } = useTranslation();
  const featureLabel = t(`billing.features.${featureKey}`);
  const starterValue = getPlanDisplayValue("starter", featureKey, t);
  const plusValue = getPlanDisplayValue("plus", featureKey, t);
  const proValue = getPlanDisplayValue("pro", featureKey, t);
  const isActivePlan = entitlements?.plan;
  const userFeature = entitlements?.features?.[featureKey];

  return (
    <div className="grid grid-cols-4 items-center gap-4 rounded-2xl px-4 py-3 hover:">
      <div className="flex items-center gap-2 text-sm font-semibold text-content-primary">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--border-color,#e5e7eb)] ${
            userFeature?.enabled
              ? "bg-[color:var(--primary-soft,rgba(29,83,48,0.10))] text-[color:var(--primary-bright,#2a7347)]"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          <GarzoniIcon
            name={userFeature?.enabled ? "check" : "lock"}
            size={16}
          />
        </span>
        <div>
          <div>{featureLabel}</div>
          <p className="text-xs text-content-muted">
            {userFeature?.description || plusValue}
          </p>
        </div>
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "starter"
            ? "font-semibold text-[color:var(--accent,#ffd700)]"
            : "text-content-muted"
        }`}
      >
        {starterValue}
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "plus"
            ? "font-semibold text-[color:var(--accent,#ffd700)]"
            : "text-content-muted"
        }`}
      >
        {plusValue}
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "pro"
            ? "font-semibold text-[color:var(--accent,#ffd700)]"
            : "text-content-muted"
        }`}
      >
        {proValue}
      </div>
    </div>
  );
};

const EntitlementMatrix = ({
  entitlements,
}: {
  entitlements?: EntitlementsPayload;
}) => {
  const { t } = useTranslation();
  const planLabel =
    entitlements?.label ||
    (entitlements?.plan || "starter").charAt(0).toUpperCase() +
      (entitlements?.plan || "starter").slice(1);
  return (
    <GlassCard padding="xl" className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-content-muted">
          {t("billing.featureComparison")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-content-primary">
            {t("billing.planComparison")}
          </h3>
          <span className="rounded-full bg-[color:var(--primary,#1d5330)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary,#1d5330)]">
            {t("billing.current")}: {planLabel}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 rounded-2xl bg-surface-page px-4 py-3 text-xs font-semibold text-content-muted">
        <span>{t("billing.capability")}</span>
        <span className="text-center">{t("billing.starter")}</span>
        <span className="text-center">{t("billing.plus")}</span>
        <span className="text-center">{t("billing.pro")}</span>
      </div>

      <div className="space-y-2">
        {(Object.keys(FEATURE_COPY) as FeatureKey[]).map((featureKey) => (
          <FeatureRow
            key={featureKey}
            featureKey={featureKey}
            entitlements={entitlements}
          />
        ))}
      </div>
    </GlassCard>
  );
};

export default EntitlementMatrix;
