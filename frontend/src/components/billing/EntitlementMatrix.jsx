import React from "react";
import { GlassCard } from "components/ui";
import { FEATURE_COPY } from "services/entitlementsService";

const PLAN_DETAILS = {
  free: {
    daily_limits: "3 per day",
    hints: "2 per day",
    streak_repair: "Locked",
    downloads: "1 per day",
    analytics: "Locked",
    ai_tutor: "5 prompts/day",
  },
  premium: {
    daily_limits: "Unlimited",
    hints: "Unlimited",
    streak_repair: "1 per day",
    downloads: "Unlimited",
    analytics: "Unlocked",
    ai_tutor: "50 prompts/day",
  },
};

const FeatureRow = ({ featureKey, entitlements }) => {
  const feature = FEATURE_COPY[featureKey];
  const freeValue = PLAN_DETAILS.free[featureKey];
  const premiumValue = PLAN_DETAILS.premium[featureKey];
  const isActivePlan = entitlements?.plan;
  const userFeature = entitlements?.features?.[featureKey];

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
          <div>{feature}</div>
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

const EntitlementMatrix = ({ entitlements }) => {
  return (
    <GlassCard padding="xl" className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          Plans
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-[color:var(--text-color,#111827)]">
            Free vs Premium capabilities
          </h3>
          <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary,#2563eb)]">
            Current plan: {entitlements?.label || "Free"}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 rounded-2xl bg-[color:var(--bg-color,#f8fafc)] px-4 py-3 text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
        <span>Capability</span>
        <span className="text-center">Free</span>
        <span className="text-center">Premium</span>
      </div>

      <div className="space-y-2">
        {Object.keys(FEATURE_COPY).map((featureKey) => (
          <FeatureRow key={featureKey} featureKey={featureKey} entitlements={entitlements} />
        ))}
      </div>
    </GlassCard>
  );
};

export default EntitlementMatrix;
