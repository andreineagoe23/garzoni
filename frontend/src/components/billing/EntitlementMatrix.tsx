import React from "react";
import { GlassCard } from "components/ui";
import { FEATURE_COPY } from "services/entitlementsService";

const PLAN_DETAILS = {
  starter: {
    daily_limits: "3 / day",
    hints: "2 / day",
    streak_repair: "Not available",
    downloads: "1 / day",
    analytics: "Not available",
    ai_tutor: "5 / day",
    personalized_path: "Not included",
  },
  plus: {
    daily_limits: "Unlimited",
    hints: "Unlimited",
    streak_repair: "1 / day",
    downloads: "Unlimited",
    analytics: "Included",
    ai_tutor: "50 / day",
    personalized_path: "Included",
  },
  pro: {
    daily_limits: "Unlimited",
    hints: "Unlimited",
    streak_repair: "1 / day",
    downloads: "Unlimited",
    analytics: "Included",
    ai_tutor: "200 / day",
    personalized_path: "Included",
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
  const feature = FEATURE_COPY[featureKey];
  const starterValue =
    PLAN_DETAILS.starter[featureKey as keyof typeof PLAN_DETAILS.starter];
  const plusValue = PLAN_DETAILS.plus[featureKey as keyof typeof PLAN_DETAILS.plus];
  const proValue = PLAN_DETAILS.pro[featureKey as keyof typeof PLAN_DETAILS.pro];
  const isActivePlan = entitlements?.plan;
  const userFeature = entitlements?.features?.[featureKey];
  const featureLabel = feature;

  return (
    <div className="grid grid-cols-4 items-center gap-4 rounded-2xl px-4 py-3 hover:bg-[color:var(--bg-color,#f8fafc)]/60">
      <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-color,#111827)]">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--border-color,#e5e7eb)] ${
            userFeature?.enabled
              ? "bg-emerald-50 text-emerald-600"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          {userFeature?.enabled ? "✓" : "🔒"}
        </span>
        <div>
          <div>{featureLabel}</div>
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            {userFeature?.description || plusValue}
          </p>
        </div>
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "starter"
            ? "font-semibold text-[color:var(--accent,#2563eb)]"
            : "text-[color:var(--muted-text,#6b7280)]"
        }`}
      >
        {starterValue}
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "plus"
            ? "font-semibold text-[color:var(--accent,#2563eb)]"
            : "text-[color:var(--muted-text,#6b7280)]"
        }`}
      >
        {plusValue}
      </div>
      <div
        className={`text-sm text-center ${
          isActivePlan === "pro"
            ? "font-semibold text-[color:var(--accent,#2563eb)]"
            : "text-[color:var(--muted-text,#6b7280)]"
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
  return (
    <GlassCard padding="xl" className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          Feature Comparison
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-[color:var(--text-color,#111827)]">
            Plan Comparison
          </h3>
          <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary,#2563eb)]">
            Current: {entitlements?.label || (entitlements?.plan || "starter").charAt(0).toUpperCase() + (entitlements?.plan || "starter").slice(1)}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 rounded-2xl bg-[color:var(--bg-color,#f8fafc)] px-4 py-3 text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
        <span>Capability</span>
        <span className="text-center">
          Starter
        </span>
        <span className="text-center">
          Plus
        </span>
        <span className="text-center">
          Pro
        </span>
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
