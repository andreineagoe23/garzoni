import React from "react";
import { GlassCard } from "components/ui";
import { FEATURE_COPY } from "services/entitlementsService";
import { useTranslation } from "react-i18next";

const PLAN_DETAILS = {
  free: {
    daily_limits: "entitlementMatrix.values.free.daily_limits",
    hints: "entitlementMatrix.values.free.hints",
    streak_repair: "entitlementMatrix.values.free.streak_repair",
    downloads: "entitlementMatrix.values.free.downloads",
    analytics: "entitlementMatrix.values.free.analytics",
    ai_tutor: "entitlementMatrix.values.free.ai_tutor",
  },
  premium: {
    daily_limits: "entitlementMatrix.values.premium.daily_limits",
    hints: "entitlementMatrix.values.premium.hints",
    streak_repair: "entitlementMatrix.values.premium.streak_repair",
    downloads: "entitlementMatrix.values.premium.downloads",
    analytics: "entitlementMatrix.values.premium.analytics",
    ai_tutor: "entitlementMatrix.values.premium.ai_tutor",
  },
};

type EntitlementsPayload = {
  plan?: string;
  label?: string;
  features?: Record<string, { enabled?: boolean; description?: string }>;
};

type FeatureKey = keyof typeof FEATURE_COPY;

const FeatureRow = ({
  featureKey,
  entitlements,
}: {
  featureKey: FeatureKey;
  entitlements?: EntitlementsPayload;
}) => {
  const { t } = useTranslation("billing");
  const feature = FEATURE_COPY[featureKey];
  const freeValue = t(
    PLAN_DETAILS.free[featureKey as keyof typeof PLAN_DETAILS.free]
  );
  const premiumValue = t(
    PLAN_DETAILS.premium[featureKey as keyof typeof PLAN_DETAILS.premium]
  );
  const isActivePlan = entitlements?.plan;
  const userFeature = entitlements?.features?.[featureKey];
  const featureLabel = t(`entitlements.features.${featureKey}`, {
    defaultValue: feature,
  });

  return (
    <div className="grid grid-cols-3 items-center gap-4 rounded-2xl px-4 py-3 hover:bg-[color:var(--bg-color,#f8fafc)]/60">
      <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-color,#111827)]">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--border-color,#e5e7eb)] ${
            userFeature?.enabled ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
          }`}
        >
          {userFeature?.enabled ? "✓" : "🔒"}
        </span>
        <div>
          <div>{featureLabel}</div>
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            {userFeature?.description || premiumValue}
          </p>
        </div>
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "free"
            ? "font-semibold text-[color:var(--accent,#2563eb)]"
            : "text-[color:var(--muted-text,#6b7280)]"
        }`}
      >
        {freeValue}
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "premium"
            ? "font-semibold text-[color:var(--accent,#2563eb)]"
            : "text-[color:var(--muted-text,#6b7280)]"
        }`}
      >
        {premiumValue}
      </div>
    </div>
  );
};

const EntitlementMatrix = ({
  entitlements,
}: {
  entitlements?: EntitlementsPayload;
}) => {
  const { t } = useTranslation("billing");
  return (
    <GlassCard padding="xl" className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          {t("entitlementMatrix.kicker")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-[color:var(--text-color,#111827)]">
            {t("entitlementMatrix.title")}
          </h3>
          <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary,#2563eb)]">
            {t("entitlementMatrix.currentPlan", {
              plan: t(`plans.${entitlements?.plan || "starter"}`, {
                defaultValue: entitlements?.label || t("plans.starter"),
              }),
            })}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 rounded-2xl bg-[color:var(--bg-color,#f8fafc)] px-4 py-3 text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
        <span>{t("entitlementMatrix.headers.capability")}</span>
        <span className="text-center">{t("entitlementMatrix.headers.free")}</span>
        <span className="text-center">{t("entitlementMatrix.headers.premium")}</span>
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
