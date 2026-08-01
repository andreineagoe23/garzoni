import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "contexts/AuthContext";
import apiClient from "services/httpClient";
import { recordToolEvent } from "services/toolsAnalytics";
import { recordFunnelEvent } from "services/analyticsService";
import CFODashboard from "./CFODashboard";

const ACTIVITY_STORAGE_KEY = "garzoni:tools:activity:personal-cfo";
const COMPLETION_STORAGE_KEY = "garzoni:tools:personal-cfo:completed-steps";

type CFOStepId =
  "goals" | "savings" | "budget" | "portfolio" | "market" | "next-steps";

type CFOStepDefinition = {
  id: CFOStepId;
  job: "plan" | "track" | "invest" | "scout" | "act";
  toolId: string;
  toolRoute: string;
  iconKey: string;
  estimatedMinutes: number;
  phase: "live" | "preview";
};

const STEPS: CFOStepDefinition[] = [
  {
    id: "goals",
    job: "plan",
    toolId: "reality-check",
    toolRoute: "reality-check",
    iconKey: "target",
    estimatedMinutes: 8,
    phase: "live",
  },
  {
    id: "savings",
    job: "plan",
    toolId: "savings-calculator",
    toolRoute: "savings-calculator",
    iconKey: "piggy",
    estimatedMinutes: 5,
    phase: "live",
  },
  {
    id: "budget",
    job: "track",
    toolId: "budget-planner",
    toolRoute: "budget-planner",
    iconKey: "wallet",
    estimatedMinutes: 12,
    phase: "preview",
  },
  {
    id: "portfolio",
    job: "invest",
    toolId: "portfolio",
    toolRoute: "portfolio",
    iconKey: "pie",
    estimatedMinutes: 12,
    phase: "live",
  },
  {
    id: "market",
    job: "scout",
    toolId: "market-explorer",
    toolRoute: "market-explorer",
    iconKey: "trend",
    estimatedMinutes: 10,
    phase: "live",
  },
  {
    id: "next-steps",
    job: "act",
    toolId: "next-steps",
    toolRoute: "next-steps",
    iconKey: "footsteps",
    estimatedMinutes: 5,
    phase: "live",
  },
];

const STEP_ACTIVITY_KEYS: Record<CFOStepId, string | null> = {
  goals: "garzoni:tools:activity:reality-check",
  savings: "garzoni:tools:activity:savings",
  budget: "garzoni:tools:activity:budget-planner",
  portfolio: "garzoni:tools:activity:portfolio",
  market: "garzoni:tools:activity:market-explorer",
  "next-steps": "garzoni:tools:activity:next-steps",
};

const ICONS: Record<string, JSX.Element> = {
  target: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  piggy: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 13c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6v3a2 2 0 0 1-2 2h-1l-1 2h-2l-1-2H9l-1 2H6l-1-2H4v-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 9h13a2 2 0 0 1 0 4H3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ),
  pie: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v9h9a9 9 0 1 1-9-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 3a8 8 0 0 1 7 7h-7V3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 17 9 11l4 4 8-9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 5h6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  footsteps: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 8c0-1.7 1.3-3 2.5-3S12 6.3 12 8s-.5 4-2 4-3-2.3-3-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14 14c0-1.7 1.3-3 2.5-3s2.5 1.3 2.5 3-.5 4-2 4-3-2.3-3-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  ),
};

type CFOSummary = {
  status: string;
  generated_at?: string | null;
  highlights?: string[];
  alerts?: string[];
  next_action?: { label: string; href?: string | null } | null;
};

function loadCompletedSteps(): Set<CFOStepId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COMPLETION_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as CFOStepId[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function persistCompletedSteps(steps: Set<CFOStepId>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMPLETION_STORAGE_KEY,
      JSON.stringify(Array.from(steps))
    );
  } catch {
    /* best-effort */
  }
}

function detectAutoComplete(stepId: CFOStepId): boolean {
  if (typeof window === "undefined") return false;
  const key = STEP_ACTIVITY_KEYS[stepId];
  if (!key) return false;
  return Boolean(window.sessionStorage.getItem(key));
}

type ProgressResponse = {
  steps: Partial<Record<CFOStepId, boolean>>;
  completion: {
    done: number;
    total: number;
    ratio: number;
    is_complete: boolean;
  };
};

const VIEW_PREF_KEY = "garzoni:tools:personal-cfo:view";

function loadViewPref(): "auto" | "steps" {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(VIEW_PREF_KEY);
    if (raw === "steps") return "steps";
    return "auto";
  } catch {
    return "auto";
  }
}

const PersonalCFOHub = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [completed, setCompleted] = useState<Set<CFOStepId>>(() =>
    loadCompletedSteps()
  );
  const [summary, setSummary] = useState<CFOSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [viewPref, setViewPref] = useState<"auto" | "steps">(() =>
    loadViewPref()
  );
  const [backendComplete, setBackendComplete] = useState(false);

  useEffect(() => {
    setCompleted((prev) => {
      const next = new Set(prev);
      let changed = false;
      STEPS.forEach((step) => {
        if (!next.has(step.id) && detectAutoComplete(step.id)) {
          next.add(step.id);
          changed = true;
        }
      });
      if (!changed) return prev;
      persistCompletedSteps(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/personal-cfo/progress/")
      .then((res) => {
        if (cancelled) return;
        const data = res.data as ProgressResponse;
        setBackendComplete(data?.completion?.is_complete ?? false);
        setCompleted((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const step of STEPS) {
            if (data?.steps?.[step.id] && !next.has(step.id)) {
              next.add(step.id);
              changed = true;
            }
          }
          if (changed) persistCompletedSteps(next);
          return changed ? next : prev;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      ACTIVITY_STORAGE_KEY,
      JSON.stringify({ label: t("tools.personalCfo.activityLabel") })
    );
    if (typeof window.gtag === "function") {
      window.gtag("event", "personal_cfo_open", {
        tool_id: "personal-cfo",
      });
    }
    recordToolEvent("personal_cfo_open", "personal-cfo");
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    apiClient
      .get("/personal-cfo/summary/")
      .then((res) => {
        if (cancelled) return;
        setSummary(res.data ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 402) {
          setSummaryError(t("tools.personalCfo.errors.upgradeRequired"));
        } else if (err?.response?.status === 404) {
          setSummary(null);
        } else {
          setSummaryError(t("tools.personalCfo.errors.summaryFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const completionRatio = useMemo(() => {
    const totalLive = STEPS.filter((s) => s.phase === "live").length;
    const doneLive = STEPS.filter(
      (s) => s.phase === "live" && completed.has(s.id)
    ).length;
    return totalLive === 0 ? 0 : doneLive / totalLive;
  }, [completed]);

  const completionPercent = Math.round(completionRatio * 100);

  const handleStepClick = (step: CFOStepDefinition) => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "personal_cfo_step_click", {
        tool_id: "personal-cfo",
        step_id: step.id,
        target_tool: step.toolId,
      });
    }
    recordToolEvent("personal_cfo_step_click", "personal-cfo", {
      step_id: step.id,
      target_tool: step.toolId,
    });
    recordFunnelEvent("personal_cfo_step_click", {
      metadata: {
        step_id: step.id,
        target_tool: step.toolId,
        phase: step.phase,
        surface: "web",
      },
    }).catch(() => undefined);
    setCompleted((prev) => {
      if (prev.has(step.id)) return prev;
      const next = new Set(prev);
      next.add(step.id);
      persistCompletedSteps(next);
      return next;
    });
  };

  const handleMarkComplete = (stepId: CFOStepId) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      persistCompletedSteps(next);
      return next;
    });
  };

  useEffect(() => {
    if (completionRatio < 1) return;
    if (typeof window === "undefined") return;
    const key = "garzoni:tools:personal-cfo:completed-fired";
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "true");
    if (typeof window.gtag === "function") {
      window.gtag("event", "personal_cfo_completed", {
        tool_id: "personal-cfo",
      });
    }
    recordToolEvent("personal_cfo_completed", "personal-cfo");
    recordFunnelEvent("personal_cfo_completed", {
      metadata: { surface: "web" },
    }).catch(() => undefined);
  }, [completionRatio]);

  const firstName =
    user && typeof user === "object" && "first_name" in user
      ? (user.first_name as string | undefined)
      : undefined;

  const persistViewPref = useCallback((pref: "auto" | "steps") => {
    setViewPref(pref);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(VIEW_PREF_KEY, pref);
      }
    } catch {
      /* best-effort */
    }
  }, []);

  const isFullyComplete = backendComplete || completionRatio >= 1;
  const showDashboard = isFullyComplete && viewPref === "auto";

  if (showDashboard) {
    return (
      <section className="space-y-4 min-w-0 w-full">
        <CFODashboard onReviewSteps={() => persistViewPref("steps")} />
      </section>
    );
  }

  return (
    <section className="space-y-6 min-w-0 w-full">
      {isFullyComplete && viewPref === "steps" && (
        <button
          type="button"
          onClick={() => persistViewPref("auto")}
          className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-brand-primary)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
        >
          {t("tools.personalCfo.openDashboard")}
          <span aria-hidden="true">→</span>
        </button>
      )}
      <div className="app-card app-card--pad-lg overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.personalCfo.eyebrow")}
            </p>
            <h2 className="app-display text-2xl text-content-primary sm:text-3xl">
              {firstName
                ? t("tools.personalCfo.greeting", { name: firstName })
                : t("tools.personalCfo.title")}
            </h2>
            <p className="text-sm text-content-muted">
              {t("tools.personalCfo.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-card)] px-4 py-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[color:var(--color-brand-primary)]/30">
              <span className="text-sm font-bold text-[color:var(--color-brand-primary)]">
                {completionPercent}%
              </span>
            </div>
            <div className="text-xs">
              <p className="font-semibold text-content-primary">
                {t("tools.personalCfo.progressTitle")}
              </p>
              <p className="text-content-muted">
                {t("tools.personalCfo.progressSubtitle", {
                  done: STEPS.filter(
                    (s) => s.phase === "live" && completed.has(s.id)
                  ).length,
                  total: STEPS.filter((s) => s.phase === "live").length,
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 h-1.5 w-full rounded-full bg-[color:var(--color-border-default)] overflow-hidden">
          <div
            className="h-full bg-[color:var(--color-brand-primary)] transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {summaryError ? (
        <div className="app-card app-card--pad text-sm text-content-muted">
          {summaryError}
        </div>
      ) : summary ? (
        <div className="app-card app-card--pad">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {t("tools.personalCfo.summary.title")}
            </p>
            {summary.generated_at && (
              <p className="text-xs text-content-muted">
                {t("tools.personalCfo.summary.updated", {
                  date: new Date(summary.generated_at).toLocaleDateString(),
                })}
              </p>
            )}
          </div>
          {summary.highlights && summary.highlights.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-content-primary">
              {summary.highlights.map((line, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-primary)]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          {summary.alerts && summary.alerts.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {summary.alerts.map((line, idx) => (
                <li
                  key={idx}
                  className="flex gap-2 text-[color:var(--warning,#b45309)]"
                >
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--warning,#b45309)]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          {summary.next_action && (
            <Link
              to={summary.next_action.href ?? "/tools/next-steps"}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-brand-primary)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
            >
              {summary.next_action.label}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      ) : summaryLoading ? (
        <div className="app-card app-card--pad text-sm text-content-muted">
          {t("tools.personalCfo.summary.loading")}
        </div>
      ) : null}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
        {STEPS.map((step, index) => {
          const isCompleted = completed.has(step.id);
          const isPreview = step.phase === "preview";
          return (
            <div
              key={step.id}
              className="app-card app-card--pad-sm flex h-full flex-col gap-3 transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)]/10 text-[10px] font-bold text-[color:var(--color-brand-primary)]">
                    {index + 1}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--color-border-default)] text-[color:var(--color-brand-primary)]">
                    <span className="h-4 w-4">{ICONS[step.iconKey]}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isPreview && (
                    <span className="rounded-full bg-[color:var(--warning,#b45309)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--warning,#b45309)]">
                      {t("tools.personalCfo.badges.preview")}
                    </span>
                  )}
                  {isCompleted && (
                    <span className="rounded-full bg-[color:var(--color-brand-primary)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--color-brand-primary)]">
                      {t("tools.personalCfo.badges.done")}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-content-primary">
                  {t(`tools.personalCfo.steps.${step.id}.title`)}
                </p>
                <p className="text-xs text-content-muted">
                  {t(`tools.personalCfo.steps.${step.id}.description`)}
                </p>
              </div>

              <p className="text-[11px] italic text-content-muted">
                {t(`tools.personalCfo.steps.${step.id}.because`)}
              </p>

              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <Link
                  to={`/tools/${step.toolRoute}`}
                  onClick={() => handleStepClick(step)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[color:var(--color-brand-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[color:var(--color-brand-primary-hover)]"
                >
                  {isPreview
                    ? t("tools.personalCfo.cta.preview")
                    : isCompleted
                      ? t("tools.personalCfo.cta.revisit")
                      : t("tools.personalCfo.cta.open")}
                  <span aria-hidden="true">→</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleMarkComplete(step.id)}
                  className="rounded-full border border-[color:var(--color-border-default)] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-muted transition hover:text-content-primary"
                  aria-label={
                    isCompleted
                      ? t("tools.personalCfo.markIncomplete")
                      : t("tools.personalCfo.markComplete")
                  }
                  title={
                    isCompleted
                      ? t("tools.personalCfo.markIncomplete")
                      : t("tools.personalCfo.markComplete")
                  }
                >
                  {isCompleted ? "↺" : "✓"}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] text-content-muted">
                <span>
                  {t("tools.personalCfo.estimatedMinutes", {
                    count: step.estimatedMinutes,
                  })}
                </span>
                <span>{t(`tools.personalCfo.jobs.${step.job}`)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="app-card app-card--pad text-xs text-content-muted">
        <p className="font-semibold text-content-primary">
          {t("tools.personalCfo.disclaimer.title")}
        </p>
        <p className="mt-1">{t("tools.personalCfo.disclaimer.body")}</p>
      </div>
    </section>
  );
};

export default PersonalCFOHub;
