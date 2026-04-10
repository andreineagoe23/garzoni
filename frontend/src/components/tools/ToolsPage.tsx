import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import toast from "react-hot-toast";
import PageContainer from "components/common/PageContainer";
import ErrorBoundary from "components/common/ErrorBoundary";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import { GlassCard } from "components/ui";
import { ChevronDown } from "components/ui/icons";
import { useAuth } from "contexts/AuthContext";
import { useTheme } from "contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import ToolsAnalyticsPanel from "./ToolsAnalyticsPanel";
import ToolSignalStrip from "./ToolSignalStrip";
import { recordToolEvent } from "services/toolsAnalytics";
import {
  TOOL_STORAGE_KEYS,
  toolByRoute,
  toolGroups,
  toolsRegistry,
  type ToolDefinition,
} from "./toolsRegistry";

const TOOL_BASE_PATH = "/tools";
const TOOL_FEEDBACK_EMAIL = "hello@garzoni.app";

type ToolNavSource = "hub_card" | "sidebar" | "mobile_dropdown" | "deep_link";

const getSessionId = () => {
  if (typeof window === "undefined") return "server-session";
  const stored = sessionStorage.getItem(TOOL_STORAGE_KEYS.sessionId);
  if (stored) return stored;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  sessionStorage.setItem(TOOL_STORAGE_KEYS.sessionId, generated);
  return generated;
};

const ToolLoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-white/30 bg-[color:var(--card-bg,#ffffff)]/70 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-6">
      <SkeletonGroup>
        <Skeleton className="h-5 w-48" rounded="lg" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-4 w-64" />
      </SkeletonGroup>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl md:col-span-2" />
    </div>
  </div>
);

const UnknownToolRedirect = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useEffect(() => {
    toast.error(t("tools.errors.toolNotFound"));
    navigate(TOOL_BASE_PATH, { replace: true });
  }, [navigate, t]);
  return null;
};

/**
 * Landing dashboard: live tools front and center, no images, no cards, no text walls.
 *
 * Layout:
 *   [Signal strip]
 *   [Market Explorer — full-width live chart, hero panel]
 *   [Crypto Tools — left live chart] [Next Steps — right live recommendations]
 *   [Tool quick-access row — minimal pills for tools needing input]
 */
const ToolsLanding = ({
  onNavigate,
  hasPlusAccess,
}: {
  onNavigate: (source: ToolNavSource) => void;
  hasPlusAccess: boolean;
}) => {
  const { t } = useTranslation();
  const showAnalytics =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("analytics") === "1";

  // Tools that need user input — shown as minimal tap-to-open pills at bottom
  const quickAccessTools = toolsRegistry.filter((r) =>
    [
      "portfolio",
      "reality-check",
      "calendar",
      "economic-map",
      "news-context",
      "next-steps",
    ].includes(r.id)
  );

  return (
    <div className="space-y-4 min-w-0">
      {/* Signal strip */}
      <ToolSignalStrip />

      {/* ── Main row: Market Explorer (left, 2/3) + Next Steps (right, 1/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Market Explorer — takes 2/3 width on desktop */}
        <div className="flex flex-col rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/95 overflow-hidden shadow-xl shadow-black/10 lg:col-span-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-color)] shrink-0">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                {t("tools.groups.decide-next.title")}
              </span>
              <h2 className="text-sm font-semibold text-content-primary">
                {t("tools.entries.market-explorer.title")}
              </h2>
            </div>
            <Link
              to={`${TOOL_BASE_PATH}/market-explorer`}
              onClick={() => onNavigate("hub_card")}
              className="text-xs font-semibold text-[color:var(--primary)] hover:opacity-70 transition"
            >
              {t("tools.hub.open")} →
            </Link>
          </div>
          <React.Suspense
            fallback={
              <div
                style={{ height: 700 }}
                className="animate-pulse bg-[color:var(--border-color)]/20"
              />
            }
          >
            {hasPlusAccess ? (
              <MarketExplorerEmbed />
            ) : (
              <LockedPanel
                label={t("tools.entries.market-explorer.title")}
                to={`${TOOL_BASE_PATH}/market-explorer`}
                onNavigate={onNavigate}
              />
            )}
          </React.Suspense>
        </div>

        {/* Next Steps — takes 1/3 width on desktop, full height of row */}
        <div className="flex flex-col rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/95 overflow-hidden shadow-xl shadow-black/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-color)] shrink-0">
            <h2 className="text-sm font-semibold text-content-primary">
              {t("tools.entries.next-steps.title")}
            </h2>
            <Link
              to={`${TOOL_BASE_PATH}/next-steps`}
              onClick={() => onNavigate("hub_card")}
              className="text-xs font-semibold text-[color:var(--primary)] hover:opacity-70 transition"
            >
              {t("tools.hub.open")} →
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <React.Suspense
              fallback={
                <div
                  style={{ height: 200 }}
                  className="animate-pulse bg-[color:var(--border-color)]/20 rounded-xl"
                />
              }
            >
              <NextStepsEmbed />
            </React.Suspense>
          </div>
        </div>
      </div>

      {/* ── Quick-access row: tools needing input, no images ── */}
      <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/95 px-4 py-4 shadow-xl shadow-black/10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-muted">
          {t("tools.hub.browseAll")}
        </p>
        <div className="flex flex-wrap gap-2">
          {quickAccessTools.map((tool) => {
            const isLocked =
              tool.requiredPlan === "plus_or_pro" && !hasPlusAccess;
            return (
              <Link
                key={tool.id}
                to={`${TOOL_BASE_PATH}/${tool.route}`}
                onClick={() => onNavigate("hub_card")}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition",
                  isLocked
                    ? "border-[color:var(--border-color)] text-content-muted opacity-60 cursor-not-allowed"
                    : "border-[color:var(--border-color)] text-content-primary hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]",
                ].join(" ")}
              >
                {t(`tools.entries.${tool.id}.title`)}
                {isLocked && (
                  <span className="text-[9px] font-bold uppercase text-[color:var(--accent,#ffd700)]">
                    Plus
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {showAnalytics && <ToolsAnalyticsPanel />}
    </div>
  );
};

// ─── Inline embed components (lightweight wrappers, no tool chrome) ──────────

/** Market Explorer chart at reduced height for the hub hero panel. */
const MarketExplorerEmbed = React.memo(() => {
  const { darkMode } = useTheme();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const injected = React.useRef(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || injected.current) return;
    injected.current = true;
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      allow_symbol_change: true,
      calendar: false,
      details: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval: "D",
      locale: "en",
      save_image: false,
      style: "1",
      symbol: "NASDAQ:AAPL",
      theme: darkMode ? "dark" : "light",
      timezone: "Etc/UTC",
      backgroundColor: darkMode ? "#0F0F0F" : "#FFFFFF",
      gridColor: "rgba(242,242,242,0.06)",
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      autosize: true,
    });
    el.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full"
      style={{ height: 700 }}
    >
      <div className="tradingview-widget-container__widget w-full h-full" />
    </div>
  );
});
MarketExplorerEmbed.displayName = "MarketExplorerEmbed";

/** Next Steps recommendations stripped of their own chrome (header/toggle moved to hub panel). */
const NextStepsEmbed = React.memo(() => {
  const { financialProfile } = useAuth();

  const recommendations = React.useMemo(() => {
    const KEYS = [
      "garzoni:tools:activity:calendar",
      "garzoni:tools:activity:news-context",
      "garzoni:tools:activity:portfolio",
      "garzoni:tools:activity:reality-check",
      "garzoni:tools:activity:market-explorer",
    ];
    const activity = KEYS.map((k) =>
      typeof window !== "undefined" ? sessionStorage.getItem(k) : null
    ).filter(Boolean);

    if (activity.length === 0) {
      return [
        {
          id: "d1",
          label: "Learn: Inflation basics",
          href: "/all-topics?topic=inflation",
          because: "A good first step for anyone.",
        },
        {
          id: "d2",
          label: "Try: Goals Reality Check",
          href: "/tools/reality-check",
          because: "Test a goal against your budget in 2 min.",
        },
        {
          id: "d3",
          label: "Explore: Market Explorer",
          href: "/tools/market-explorer",
          because: "Builds context before decisions.",
        },
      ];
    }

    const portfolioRisk =
      typeof window !== "undefined"
        ? sessionStorage.getItem("garzoni:tools:signal:portfolio_risk")
        : null;
    const candidates: Array<{
      id: string;
      label: string;
      href: string;
      because: string;
      score: number;
    }> = [];

    if (portfolioRisk === "high") {
      candidates.push({
        id: "r1",
        label: "Learn: Diversification",
        href: "/all-topics?topic=diversification",
        because: "Your portfolio has high concentration.",
        score: 3,
      });
    }
    const goals = financialProfile?.goal_types || [];
    if (goals.some((g) => ["save", "emergency", "savings"].includes(g))) {
      candidates.push({
        id: "r2",
        label: "Try: Goals Reality Check",
        href: "/tools/reality-check",
        because: "You have a savings goal to check.",
        score: 2,
      });
    }
    if (financialProfile?.investing_experience === "new") {
      candidates.push({
        id: "r3",
        label: "Explore: Market Explorer",
        href: "/tools/market-explorer",
        because: "Good for building market intuition.",
        score: 2,
      });
    }
    if (candidates.length === 0) {
      candidates.push(
        {
          id: "r4",
          label: "Check upcoming macro events",
          href: "/tools/calendar",
          because: "See what moves markets this week.",
          score: 1,
        },
        {
          id: "r5",
          label: "Review portfolio concentration",
          href: "/tools/portfolio",
          because: "Keep risk in check.",
          score: 1,
        },
        {
          id: "r6",
          label: "Reality-check your next goal",
          href: "/tools/reality-check",
          because: "Align goals with your cash flow.",
          score: 1,
        }
      );
    }
    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [financialProfile]);

  return (
    <div className="space-y-2">
      {recommendations.map((item) => (
        <Link
          key={item.id}
          to={item.href}
          className="flex flex-col rounded-xl border border-[color:var(--border-color)] px-3 py-3 text-sm transition hover:border-[color:var(--primary)] hover:bg-[color:var(--primary)]/5"
        >
          <span className="font-semibold text-content-primary">
            {item.label}
          </span>
          <span className="mt-0.5 text-xs text-content-muted">
            {item.because}
          </span>
        </Link>
      ))}
    </div>
  );
});
NextStepsEmbed.displayName = "NextStepsEmbed";

/** Shown in the hero slot when the user doesn't have Plus access. */
const LockedPanel = ({
  label,
  to,
  onNavigate,
}: {
  label: string;
  to: string;
  onNavigate: (source: ToolNavSource) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 text-center"
      style={{ height: 480 }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="text-content-muted"
      >
        <rect
          x="3"
          y="8"
          width="10"
          height="7"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 8V6a3 3 0 016 0v2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-sm font-semibold text-content-primary">{label}</p>
      <p className="text-xs text-content-muted">Available on Plus</p>
      <Link
        to={to}
        onClick={() => onNavigate("hub_card")}
        className="rounded-full border border-[color:var(--primary)] px-4 py-1.5 text-xs font-semibold text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/10"
      >
        {t("tools.hub.upgradePlus", "Upgrade to Plus")}
      </Link>
    </div>
  );
};

const ToolView = ({
  tool,
  onReset,
  onExport,
}: {
  tool: ToolDefinition;
  onReset: () => void;
  onExport: () => void;
}) => {
  const { t } = useTranslation();
  const toolTitle = t(`tools.entries.${tool.id}.title`);
  const toolWhatItDoes = t(`tools.entries.${tool.id}.whatItDoes`);
  const toolWhoItsFor = t(`tools.entries.${tool.id}.whoItsFor`);
  const toolQuestion = t(`tools.entries.${tool.id}.questionItAnswers`);
  const toolExample = t(`tools.entries.${tool.id}.sampleUseCase`);
  const Component = tool.component;
  const feedbackHref = useMemo(() => {
    const subject = t("tools.detail.feedbackSubject", {
      tool: toolTitle,
    });
    const body = t("tools.detail.feedbackBody", {
      url: typeof window !== "undefined" ? window.location.href : "",
    });
    return `mailto:${TOOL_FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [t, toolTitle]);

  const toolGroup = toolGroups.find((g) => g.id === tool.group);
  const groupLabel = toolGroup ? t(`tools.groups.${tool.group}.title`) : "";

  return (
    <div className="space-y-5 min-w-0">
      {/* Compact header */}
      <div className="rounded-2xl border border-white/30 bg-[color:var(--card-bg,#ffffff)]/70 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-6">
        {/* Top row: breadcrumb + icon action buttons */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-xs text-content-muted"
          >
            <Link
              to={TOOL_BASE_PATH}
              className="transition hover:text-content-primary"
            >
              {t("tools.nav.hubLink")}
            </Link>
            <span aria-hidden="true" className="select-none">
              /
            </span>
            <span className="font-medium text-content-primary">
              {groupLabel}
            </span>
          </nav>
          <div className="flex flex-shrink-0 items-center gap-1">
            <a
              href={feedbackHref}
              title={t("tools.detail.feedback")}
              aria-label={t("tools.detail.feedback")}
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
                  d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5.5L2 14V3z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <button
              type="button"
              title={t("tools.detail.resetTool")}
              aria-label={t("tools.detail.resetTool")}
              onClick={onReset}
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
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M2.5 2v3.5H6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {tool.exportable && (
              <button
                type="button"
                title={t("tools.detail.export")}
                aria-label={t("tools.detail.export")}
                onClick={onExport}
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
                    d="M8 2v8M5 7l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 13h12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Title + one-liner */}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-content-primary sm:text-xl">
            {toolTitle}
          </h2>
          <p className="text-sm text-content-muted">{toolWhatItDoes}</p>
        </div>
      </div>

      {/* "About this tool" disclosure */}
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 select-none text-xs font-semibold uppercase tracking-wide text-content-muted transition hover:text-content-primary">
          <ChevronDown className="h-3 w-3 transition-transform duration-200 group-open:rotate-180" />
          {t("tools.detail.aboutTool")}
        </summary>
        <div className="mt-3 space-y-3 rounded-2xl border border-white/30 bg-[color:var(--card-bg,#ffffff)]/70 p-4 backdrop-blur-sm">
          <div className="text-sm text-content-muted">
            <span className="font-semibold text-content-primary">
              {t("tools.detail.whoItsFor")}
            </span>{" "}
            {toolWhoItsFor}
          </div>
          <div className="text-sm text-content-muted">
            <span className="font-semibold text-content-primary">
              {t("tools.detail.questionAnswered")}
            </span>{" "}
            {toolQuestion}
          </div>
          <div className="text-sm text-content-muted">
            <span className="font-semibold text-content-primary">
              {t("tools.detail.example")}
            </span>{" "}
            {toolExample}
          </div>
          <Link
            to={tool.learnPath}
            onClick={() => {
              recordToolEvent("tool_to_lesson_click", tool.id, {
                href: tool.learnPath,
                source: "tool_header",
              });
              if (typeof window.gtag === "function") {
                window.gtag("event", "lesson_started_from_tool", {
                  tool_id: tool.id,
                  link: tool.learnPath,
                });
              }
            }}
            className="inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#1d5330)] hover:text-[color:var(--accent,#ffd700)]/80"
          >
            {t("tools.detail.learnConcept")}
          </Link>
        </div>
      </details>

      <ErrorBoundary>
        <Suspense fallback={<ToolLoadingSkeleton />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

// ─── Sidebar group for grouped tool nav ──────────────────────────────────────

const SidebarGroup = ({
  group,
  activeTool,
  onNavigate,
}: {
  group: (typeof toolGroups)[0];
  activeTool: ToolDefinition | null;
  onNavigate: (source: ToolNavSource) => void;
}) => {
  const { t } = useTranslation();
  const groupHasActiveTool = group.tools.some((r) => r.id === activeTool?.id);
  const [isOpen, setIsOpen] = useState(groupHasActiveTool);

  if (group.tools.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-content-muted transition hover:text-content-primary"
      >
        <span>{t(`tools.groups.${group.id}.title`)}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="mt-1 space-y-1 pl-1">
          {group.tools.map((tool) => (
            <NavLink
              key={tool.id}
              to={`${TOOL_BASE_PATH}/${tool.route}`}
              onClick={() => onNavigate("sidebar")}
              className={({ isActive }) =>
                [
                  "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition w-full",
                  isActive
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
                    : "border-[color:var(--border-color)] bg-[color:var(--card-bg)]/50 text-content-muted hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--primary)]/5 hover:text-[color:var(--accent)]",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <span className="line-clamp-1 flex-1 text-left">
                {t(`tools.entries.${tool.id}.title`)}
              </span>
              {tool.requiredPlan === "plus_or_pro" && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-[color:var(--accent,#ffd700)] opacity-80">
                  +
                </span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const ToolsPage = () => {
  const { isAuthenticated, financialProfile, entitlements } = useAuth();
  const resolvedPlan =
    (typeof entitlements?.plan === "string" ? entitlements.plan : null) ??
    "starter";
  const hasPlusAccess =
    resolvedPlan === "plus" ||
    resolvedPlan === "pro" ||
    Boolean(entitlements?.entitled);
  const { t } = useTranslation();
  const location = useLocation();
  const sessionIdRef = useRef(getSessionId());
  const navSourceRef = useRef<ToolNavSource>("deep_link");
  const analyticsRef = useRef<{ toolId: string | null; startedAt: number }>({
    toolId: null,
    startedAt: Date.now(),
  });
  const [resetNonceByTool, setResetNonceByTool] = useState<
    Record<string, number>
  >({});
  const [lastToolId, setLastToolId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(TOOL_STORAGE_KEYS.lastTool);
  });

  const activeTool = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "tools") return null;
    const route = parts[1];
    if (!route) return null;
    return toolByRoute.get(route) ?? null;
  }, [location.pathname]);

  const _lastTool = useMemo(() => {
    if (!lastToolId) return null;
    return toolsRegistry.find((tool) => tool.id === lastToolId) || null;
  }, [lastToolId]);

  const _recommendedTools = useMemo(() => {
    const picks: ToolDefinition[] = [];
    const goals = financialProfile?.goal_types || [];
    const riskComfort = financialProfile?.risk_comfort || "";
    const investingExperience = financialProfile?.investing_experience || "";

    if (goals.some((g) => ["save", "emergency", "savings"].includes(g))) {
      const tool = toolByRoute.get("reality-check");
      if (tool) picks.push(tool);
    }
    if (goals.some((g) => ["invest", "portfolio", "wealth"].includes(g))) {
      const tool = toolByRoute.get("portfolio");
      if (tool && !picks.includes(tool)) picks.push(tool);
    }
    if (investingExperience === "new") {
      const tool = toolByRoute.get("market-explorer");
      if (tool && !picks.includes(tool)) picks.push(tool);
    }
    if (riskComfort === "low") {
      const tool = toolByRoute.get("portfolio");
      if (tool && !picks.includes(tool)) picks.push(tool);
    }
    const returned = toolsRegistry.filter((tool) =>
      typeof window !== "undefined"
        ? sessionStorage.getItem(`garzoni:tools:return:${tool.id}`)
        : false
    );
    returned.forEach((tool) => {
      if (!picks.includes(tool)) picks.push(tool);
    });

    return picks.filter((tool) => tool.id !== lastToolId).slice(0, 2);
  }, [financialProfile, lastToolId]);

  const _activeSlug = activeTool?.route ?? "hub";
  const minViewportHeight = "calc(100vh - 88px - 120px)";

  const setNavSource = (source: ToolNavSource) => {
    navSourceRef.current = source;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TOOL_STORAGE_KEYS.navSource, source);
    }
  };

  const handleReset = (toolId: string) => {
    setResetNonceByTool((prev) => ({
      ...prev,
      [toolId]: (prev[toolId] ?? 0) + 1,
    }));
    toast.success(t("tools.toast.reset"));
  };

  const handleExport = (toolId: string) => {
    window.dispatchEvent(
      new CustomEvent("garzoni:tools:export", {
        detail: { toolId },
      })
    );
  };

  useEffect(() => {
    const currentToolId = activeTool?.id ?? "hub";
    const currentTitle = activeTool
      ? t(`tools.entries.${activeTool.id}.title`)
      : t("tools.nav.hubLink");
    const startedAt = analyticsRef.current.startedAt;
    const previousToolId = analyticsRef.current.toolId;
    const lastToolStored =
      typeof window !== "undefined"
        ? sessionStorage.getItem(TOOL_STORAGE_KEYS.lastTool)
        : null;

    if (activeTool?.id) {
      sessionStorage.setItem(TOOL_STORAGE_KEYS.lastTool, activeTool.id);
      setLastToolId(activeTool.id);
    }

    if (typeof window.gtag === "function") {
      if (previousToolId && previousToolId !== currentToolId) {
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000)
        );
        window.gtag("event", "tool_duration", {
          tool_id: previousToolId,
          duration_seconds: durationSeconds,
          session_id: sessionIdRef.current,
        });
      }

      const source =
        navSourceRef.current ||
        sessionStorage.getItem(TOOL_STORAGE_KEYS.navSource) ||
        "deep_link";
      window.gtag("event", "tool_view", {
        tool_id: currentToolId,
        tool_title: currentTitle,
        source,
        session_id: sessionIdRef.current,
      });
      recordToolEvent("tool_open", currentToolId, { source });

      if (activeTool?.id && lastToolStored === activeTool.id) {
        const returnKey = `garzoni:tools:return:${activeTool.id}`;
        if (!sessionStorage.getItem(returnKey)) {
          sessionStorage.setItem(returnKey, "true");
          window.gtag("event", "tool_return", {
            tool_id: activeTool.id,
            session_id: sessionIdRef.current,
          });
          recordToolEvent("tool_return", activeTool.id);
        }
      }
      navSourceRef.current = "deep_link";
    }

    analyticsRef.current = { toolId: currentToolId, startedAt: Date.now() };
  }, [activeTool, t]);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    return () => {
      const currentToolId = analyticsRef.current.toolId;
      if (!currentToolId || typeof window.gtag !== "function") return;
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - analyticsRef.current.startedAt) / 1000)
      );
      window.gtag("event", "tool_duration", {
        tool_id: currentToolId,
        duration_seconds: durationSeconds,
        session_id: sessionId,
      });
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <PageContainer maxWidth="4xl" layout="centered" className="py-16">
        <GlassCard
          padding="xl"
          className="flex flex-col items-center gap-4 text-center"
        >
          <h2 className="text-2xl font-semibold text-content-primary">
            {t("tools.authRequired.title")}
          </h2>
          <p className="max-w-xl text-sm text-content-muted">
            {t("tools.authRequired.subtitle")}
          </p>
        </GlassCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      maxWidth="7xl"
      layout="none"
      className="px-3 sm:px-6 lg:px-8"
      innerClassName="space-y-8 w-full"
    >
      <header className="space-y-2 text-center px-0 sm:px-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
          {t("tools.header.kicker")}
        </p>
        <h1 className="text-2xl font-bold text-content-primary sm:text-3xl">
          {t("tools.header.title")}
        </h1>
        <p className="text-sm text-content-muted max-w-xl mx-auto">
          {t("tools.header.subtitle")}
        </p>
      </header>

      <div
        className={
          activeTool !== null
            ? "flex w-full flex-col gap-6 md:flex-row md:items-start md:gap-8"
            : "w-full"
        }
      >
        {/* Grouped sidebar — only visible when inside a tool */}
        {activeTool !== null && (
          <aside className="w-full shrink-0 md:w-56 md:sticky md:top-24">
            <GlassCard padding="sm" className="w-full overflow-hidden">
              <NavLink
                to={TOOL_BASE_PATH}
                onClick={() => setNavSource("sidebar")}
                className={({ isActive }) =>
                  [
                    "mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
                      : "border-[color:var(--border-color)] text-content-muted hover:border-[color:var(--primary)]/40 hover:text-content-primary",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                {t("tools.nav.hubLink")}
              </NavLink>
              {toolGroups.map((group) => (
                <SidebarGroup
                  key={group.id}
                  group={group}
                  activeTool={activeTool}
                  onNavigate={setNavSource}
                />
              ))}
            </GlassCard>
          </aside>
        )}

        {/* Main content */}
        <section
          style={{ minHeight: minViewportHeight }}
          className="w-full min-w-0 flex-1"
        >
          <Routes>
            <Route
              index
              element={
                <ToolsLanding
                  onNavigate={setNavSource}
                  hasPlusAccess={hasPlusAccess}
                />
              }
            />
            {toolsRegistry.map((tool) => (
              <Route
                key={tool.id}
                path={tool.route}
                element={
                  <ToolView
                    tool={tool}
                    onReset={() => handleReset(tool.id)}
                    onExport={() => handleExport(tool.id)}
                    key={`${tool.id}-${resetNonceByTool[tool.id] ?? 0}`}
                  />
                }
              />
            ))}
            <Route path="*" element={<UnknownToolRedirect />} />
          </Routes>
        </section>
      </div>
    </PageContainer>
  );
};

export default ToolsPage;
