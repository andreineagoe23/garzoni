import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";
import { useTranslation } from "react-i18next";

const NEXT_EVENTS = [
  { label: "US CPI", date: "Coming up" },
  { label: "Fed Meeting", date: "This week" },
  { label: "NFP Report", date: "Fri" },
];

function readPortfolioLabel(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("garzoni:tools:activity:portfolio");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { label?: string };
    return parsed.label ?? null;
  } catch {
    return null;
  }
}

const ToolSignalStrip = () => {
  const { t } = useTranslation();
  const nextEvent = NEXT_EVENTS[0];
  const portfolioLabel = useMemo(() => readPortfolioLabel(), []);

  return (
    <GlassCard padding="sm" hover={false} className="w-full">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Chip 1: Next economic event */}
        <Link
          to="/tools/calendar"
          className="flex items-center gap-2 rounded-full border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/60 px-3 py-1.5 text-xs font-medium text-content-muted transition hover:border-[color:var(--primary)]/40 hover:text-content-primary"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            className="flex-shrink-0 text-[color:var(--primary)]"
            aria-hidden="true"
          >
            <rect
              x="1"
              y="3"
              width="14"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M1 7h14" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M5 1v4M11 1v4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span>
            <span className="font-semibold text-content-primary">
              {nextEvent.label}
            </span>
            {" — "}
            <span>{nextEvent.date}</span>
          </span>
        </Link>

        {/* Chip 2: Portfolio asset count (conditional on sessionStorage) */}
        {portfolioLabel && (
          <Link
            to="/tools/portfolio"
            className="flex items-center gap-2 rounded-full border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/60 px-3 py-1.5 text-xs font-medium text-content-muted transition hover:border-[color:var(--primary)]/40 hover:text-content-primary"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className="flex-shrink-0 text-[color:var(--primary)]"
              aria-hidden="true"
            >
              <path
                d="M2 12 L5 8 L8 10 L11 5 L14 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              <span className="font-semibold text-content-primary">
                Portfolio:
              </span>{" "}
              {portfolioLabel}
            </span>
          </Link>
        )}

        {/* Chip 3: Next Steps — always present */}
        <Link
          to="/tools/next-steps"
          className="flex items-center gap-2 rounded-full border border-[color:var(--primary)]/30 px-3 py-1.5 text-xs font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--primary)]/60"
          style={{ backgroundColor: "rgba(var(--primary-rgb), 0.08)" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("tools.hub.signalStrip.nextSteps")}
        </Link>
      </div>
    </GlassCard>
  );
};

export default ToolSignalStrip;
