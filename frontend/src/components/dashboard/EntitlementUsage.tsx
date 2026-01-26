import React from "react";

type EntitlementUsageItem = {
  key: string | number;
  name?: string;
  enabled?: boolean;
  used?: number;
  remaining?: number | null;
};

const EntitlementUsage = ({
  entitlementUsage = [],
}: {
  entitlementUsage?: EntitlementUsageItem[];
}) => {
  if (!entitlementUsage.length) return null;

  return (
    <div className="mt-6 rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/70 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[color:var(--text-color,#111827)]">
          Daily Usage
        </h3>
        <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
          Resets daily
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entitlementUsage.map((feature) => {
          const remaining =
            feature.remaining === null || feature.remaining === undefined
              ? "∞"
              : Math.max(feature.remaining, 0);
          const used = feature.used ?? 0;
          return (
            <div
              key={feature.key}
              className="rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.08))] bg-[color:var(--card-bg,#ffffff)]/80 px-3 py-3 text-sm"
            >
              <div className="font-semibold text-[color:var(--text-color,#111827)]">
                {feature.name}
              </div>
              {feature.enabled === false ? (
                <div className="mt-1 text-xs text-[color:var(--error,#dc2626)]">
                  Locked - Upgrade to unlock
                </div>
              ) : (
                <div className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                  {used} used, {remaining === "∞" ? "unlimited" : `${remaining} remaining`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EntitlementUsage;
