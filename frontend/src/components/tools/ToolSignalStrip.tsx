import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { GlassCard } from "components/ui";
import { useTranslation } from "react-i18next";
import { toolGroups, type ToolDefinition } from "./toolsRegistry";

export type ToolStripToolbar = {
  feedbackHref: string;
  onReset: () => void;
  onExport: () => void;
  exportable: boolean;
};

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

function ToolSwitcherDropdown({
  activeTool,
  onNavigate,
}: {
  activeTool: ToolDefinition;
  onNavigate?: (source: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)]/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/20"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {/* Grid icon */}
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="1"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="1"
            y="9"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="9"
            width="6"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span className="max-w-[140px] truncate">
          {t(`tools.entries.${activeTool.id}.title`)}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--card-bg)] shadow-xl"
          style={{
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
          role="listbox"
        >
          {toolGroups.map((group, gi) => (
            <div
              key={group.id}
              className={
                gi > 0 ? "border-t border-[color:var(--border-color)]" : ""
              }
            >
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
                {t(`tools.groups.${group.id}.title`)}
              </p>
              {group.tools.map((tool) => (
                <NavLink
                  key={tool.id}
                  to={`/tools/${tool.route}`}
                  role="option"
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.("dropdown");
                  }}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2 px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-[color:var(--primary)]/10 font-semibold text-[color:var(--primary)]"
                        : "text-content-muted hover:bg-[color:var(--primary)]/5 hover:text-content-primary",
                    ].join(" ")
                  }
                >
                  <span className="flex-1 truncate">
                    {t(`tools.entries.${tool.id}.title`)}
                  </span>
                  {tool.requiredPlan === "plus_or_pro" && (
                    <span className="text-[9px] font-bold uppercase text-[color:var(--accent,#ffd700)]">
                      +
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ToolSignalStrip = ({
  toolbar,
  activeTool,
  onNavigate,
}: {
  toolbar?: ToolStripToolbar | null;
  activeTool?: ToolDefinition | null;
  onNavigate?: (source: string) => void;
}) => {
  const { t } = useTranslation();
  const nextEvent = NEXT_EVENTS[0];
  const portfolioLabel = useMemo(() => readPortfolioLabel(), []);

  return (
    <GlassCard padding="sm" hover={false} className="w-full">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {/* Tool switcher dropdown — shown when a tool is active */}
        {activeTool && (
          <>
            <ToolSwitcherDropdown
              activeTool={activeTool}
              onNavigate={onNavigate}
            />
            <div
              className="h-4 w-px shrink-0 bg-[color:var(--border-color)]"
              aria-hidden="true"
            />
          </>
        )}

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

        {toolbar ? (
          <div className="ms-auto flex flex-shrink-0 items-center gap-1">
            <a
              href={toolbar.feedbackHref}
              title={t("tools.workspace.actionTooltipFeedback")}
              aria-label={t("tools.workspace.actionAriaFeedback")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 text-content-muted transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="2.25"
                  y="4.25"
                  width="11.5"
                  height="8.5"
                  rx="1.25"
                  stroke="currentColor"
                  strokeWidth="1.35"
                />
                <path
                  d="M2.25 5.25L8 9.25l5.75-4"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <button
              type="button"
              title={t("tools.workspace.actionTooltipReset")}
              aria-label={t("tools.workspace.actionAriaReset")}
              onClick={toolbar.onReset}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 text-content-muted transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M13.5 8A5.5 5.5 0 112.5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                />
                <path
                  d="M2.5 2v3.5H6"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {toolbar.exportable ? (
              <button
                type="button"
                title={t("tools.workspace.actionTooltipExport")}
                aria-label={t("tools.workspace.actionAriaExport")}
                onClick={toolbar.onExport}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 text-content-muted transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 3v7M5 8l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.5 13h11"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
};

export default ToolSignalStrip;
