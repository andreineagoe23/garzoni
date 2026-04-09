import React from "react";
import { useTranslation } from "react-i18next";
import { GarzoniIcon, type GarzoniIconName } from "components/ui/garzoniIcons";

type PrimaryCtaData = {
  text: string;
  action: () => void;
  iconName?: GarzoniIconName;
  priority?: "high" | "medium" | "low";
  reason?: string;
};

const PrimaryCTA = ({ primaryCTA }: { primaryCTA?: PrimaryCtaData | null }) => {
  const { t } = useTranslation();
  if (!primaryCTA) return null;

  return (
    <div
      className={`mt-6 rounded-xl border p-4 transition-all ${
        primaryCTA.priority === "high"
          ? "border-[color:var(--error,#dc2626)]/40 bg-gradient-to-r from-[color:var(--error,#dc2626)]/10 to-[color:var(--error,#dc2626)]/5"
          : primaryCTA.priority === "medium"
            ? "border-[color:var(--primary,#1d5330)]/40 bg-gradient-to-r from-[color:var(--primary,#1d5330)]/10 to-[color:var(--primary,#1d5330)]/5"
            : "border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)]/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {primaryCTA.iconName && (
            <GarzoniIcon
              name={primaryCTA.iconName}
              size={24}
              className="text-[color:var(--primary,#1d5330)]"
            />
          )}
          <div>
            <p className="font-semibold text-content-primary">
              {primaryCTA.text}
            </p>
            <p className="text-xs text-content-muted">
              {primaryCTA.reason || t("dashboard.primaryCta.continueReason")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={primaryCTA.action}
          className="rounded-full bg-[color:var(--primary,#1d5330)] px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 touch-manipulation sm:px-4 sm:py-2 sm:text-sm"
          aria-label={primaryCTA.text}
        >
          {t("dashboard.primaryCta.getStarted")}
        </button>
      </div>
    </div>
  );
};

export default PrimaryCTA;
