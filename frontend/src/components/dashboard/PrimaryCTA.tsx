import React from "react";

type PrimaryCtaData = {
  text: string;
  action: () => void;
  icon?: string;
  priority?: "high" | "medium" | "low";
  reason?: string;
};

const PrimaryCTA = ({ primaryCTA }: { primaryCTA?: PrimaryCtaData | null }) => {
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
          <span className="text-2xl" aria-hidden="true">
            {primaryCTA.icon}
          </span>
          <div>
            <p className="font-semibold text-[color:var(--text-color,#111827)]">
              {primaryCTA.text}
            </p>
            <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
              {primaryCTA.reason || "Continue your learning journey"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={primaryCTA.action}
          className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
          aria-label={primaryCTA.text}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default PrimaryCTA;
