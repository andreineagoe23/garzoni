import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import PageContainer from "components/common/PageContainer";
import ErrorBoundary from "components/common/ErrorBoundary";
import Skeleton, { SkeletonGroup } from "components/common/Skeleton";
import { GlassCard } from "components/ui";
import { useAuth } from "contexts/AuthContext";
import { useTranslation } from "react-i18next";
import ToolsAnalyticsPanel from "./ToolsAnalyticsPanel";
import { recordToolEvent } from "services/toolsAnalytics";
import {
  TOOL_STORAGE_KEYS,
  toolByRoute,
  toolGroups,
  toolsRegistry,
  type ToolDefinition } from "./toolsRegistry";

const TOOL_BASE_PATH = "/tools";
const TOOL_FEEDBACK_EMAIL = "monevo.educational@gmail.com";

type ToolNavSource =
  | "hub_card"
  | "sidebar"
  | "mobile_dropdown"
  | "deep_link";

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
    toast.error(
      t("tools.errors.toolNotFound")
    );
    navigate(TOOL_BASE_PATH, { replace: true });
  }, [navigate, t]);
  return null;
};

const ToolsHub = ({
  lastTool,
  onNavigate,
  recommendedTools }: {
  lastTool: ToolDefinition | null;
  onNavigate: (source: ToolNavSource) => void;
  recommendedTools: ToolDefinition[];
}) => {
  const { t } = useTranslation();
  const getToolText = (tool: ToolDefinition, field: string) =>
    t(`tools.entries.${tool.id}.${field}`);
  const showAnalytics =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("analytics") === "1";
  return (
    <div className="space-y-8 min-w-0">
      {lastTool && (
        <GlassCard padding="lg" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between min-w-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("tools.hub.continueTitle")}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[color:var(--accent,#111827)]">
              {getToolText(lastTool, "title")}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("tools.hub.continueSubtitle")}
            </p>
          </div>
          <Link
            to={`${TOOL_BASE_PATH}/${lastTool.route}`}
            onClick={() => onNavigate("hub_card")}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40"
          >
            {t("tools.hub.resumeTool")}
          </Link>
        </GlassCard>
      )}

      {recommendedTools.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("tools.hub.suggestedTitle")}
            </p>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("tools.hub.suggestedSubtitle")}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {recommendedTools.map((tool) => (
              <GlassCard key={tool.id} padding="lg">
                <Link
                  to={`${TOOL_BASE_PATH}/${tool.route}`}
                  onClick={() => onNavigate("hub_card")}
                  className="block"
                >
                  <h3 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {getToolText(tool, "title")}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--muted-text,#6b7280)]">
                    {getToolText(tool, "promise")}
                  </p>
                  <span className="mt-3 inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)]">
                    {t("tools.hub.openTool")}
                  </span>
                </Link>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3 min-w-0">
        {toolGroups.map((group) => (
          <section key={group.id} className="space-y-4 min-w-0">
            <div className="overflow-hidden rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--card-bg)] shadow-lg min-w-0">
              <img
                src={group.image}
                alt={t(`tools.groups.${group.id}.imageAlt`)}
                className="h-28 w-full object-cover"
              />
              <h3 className="px-4 py-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--accent)]">
                {t(`tools.groups.${group.id}.title`)}
              </h3>
            </div>
            <div className="space-y-3">
              {group.tools.map((tool) => (
                <GlassCard
                  key={tool.id}
                  padding="md"
                  className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Link
                    to={`${TOOL_BASE_PATH}/${tool.route}`}
                    onClick={() => onNavigate("hub_card")}
                    className="block"
                  >
                    <h4 className="text-sm font-semibold text-[color:var(--accent)]">
                    {getToolText(tool, "title")}
                    </h4>
                    <p className="mt-1 text-xs text-[color:var(--muted-text)] line-clamp-2">
                      {getToolText(tool, "promise")}
                    </p>
                    <span className="mt-2 inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary)]">
                      {t("tools.hub.open")}
                    </span>
                  </Link>
                </GlassCard>
              ))}
            </div>
          </section>
        ))}
      </div>
      {showAnalytics && <ToolsAnalyticsPanel />}
    </div>
  );
};

const ToolView = ({
  tool,
  onReset,
  onExport }: {
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
      tool: toolTitle });
    const body = t("tools.detail.feedbackBody", {
      url: typeof window !== "undefined" ? window.location.href : "" });
    return `mailto:${TOOL_FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }, [t, toolTitle]);

  return (
    <div className="space-y-5 min-w-0">
      <div className="rounded-lg border border-[color:var(--border-color)] bg-[color:var(--card-bg)]/80 px-3 py-2">
        <p className="text-xs font-medium text-[color:var(--muted-text)]">
          {t("tools.disclaimer.educationalOnly")}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-wide">
          <Link
            to="/financial-disclaimer"
            className="text-[color:var(--primary,#2563eb)] hover:text-[color:var(--primary,#2563eb)]/80"
          >
            {t("tools.disclaimer.financialDisclaimer")}
          </Link>
          <Link
            to="/no-financial-advice"
            className="text-[color:var(--primary,#2563eb)] hover:text-[color:var(--primary,#2563eb)]/80"
          >
            {t("tools.disclaimer.noFinancialAdvice")}
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-white/30 bg-[color:var(--card-bg,#ffffff)]/70 px-4 py-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-start sm:justify-between sm:px-6 min-w-0">
        <div className="space-y-2 min-w-0 flex-1">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--accent,#111827)] sm:text-xl">
              {toolTitle}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
              {toolWhatItDoes}
            </p>
          </div>
          <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
            <span className="font-semibold text-[color:var(--accent,#111827)]">
              {t("tools.detail.whoItsFor")}
            </span>{" "}
            {toolWhoItsFor}
          </div>
          <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
            <span className="font-semibold text-[color:var(--accent,#111827)]">
              {t("tools.detail.questionAnswered")}
            </span>{" "}
            {toolQuestion}
          </div>
          <div className="text-sm text-[color:var(--muted-text,#6b7280)]">
            <span className="font-semibold text-[color:var(--accent,#111827)]">
              {t("tools.detail.example")}
            </span>{" "}
            {toolExample}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={tool.learnPath}
              onClick={() => {
                recordToolEvent("tool_to_lesson_click", tool.id, {
                  href: tool.learnPath,
                  source: "tool_header" });
                if (typeof window.gtag === "function") {
                  window.gtag("event", "lesson_started_from_tool", {
                    tool_id: tool.id,
                    link: tool.learnPath });
                }
              }}
              className="inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)] hover:text-[color:var(--primary,#2563eb)]/80"
            >
              {t("tools.detail.learnConcept")}
            </Link>
            <Link
              to={TOOL_BASE_PATH}
              className="inline-flex text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)] hover:text-[color:var(--primary,#2563eb)]"
            >
              {t("tools.detail.backToHub")}
            </Link>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          <a
            href={feedbackHref}
            className="rounded-full border border-white/40 px-3 py-1 text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
          >
            {t("tools.detail.feedback")}
          </a>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/40 px-3 py-1 text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
          >
            {t("tools.detail.resetTool")}
          </button>
          {tool.exportable && (
            <button
              type="button"
              onClick={onExport}
              className="rounded-full border border-white/40 px-3 py-1 text-[color:var(--accent,#111827)] transition hover:border-[color:var(--primary,#2563eb)]/40 hover:text-[color:var(--primary,#2563eb)]"
            >
              {t("tools.detail.export")}
            </button>
          )}
        </div>
      </div>
      <ErrorBoundary>
        <Suspense fallback={<ToolLoadingSkeleton />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

const ToolsPage = () => {
  const { isAuthenticated, financialProfile } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const sessionIdRef = useRef(getSessionId());
  const navSourceRef = useRef<ToolNavSource>("deep_link");
  const analyticsRef = useRef<{ toolId: string | null; startedAt: number }>({
    toolId: null,
    startedAt: Date.now() });
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

  const lastTool = useMemo(() => {
    if (!lastToolId) return null;
    return toolsRegistry.find((tool) => tool.id === lastToolId) || null;
  }, [lastToolId]);

  const recommendedTools = useMemo(() => {
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
        ? sessionStorage.getItem(`monevo:tools:return:${tool.id}`)
        : false
    );
    returned.forEach((tool) => {
      if (!picks.includes(tool)) picks.push(tool);
    });

    return picks.filter((tool) => tool.id !== lastToolId).slice(0, 2);
  }, [financialProfile, lastToolId]);

  const activeSlug = activeTool?.route ?? "hub";
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
      [toolId]: (prev[toolId] ?? 0) + 1 }));
    toast.success(t("tools.toast.reset"));
  };

  const handleExport = (toolId: string) => {
    window.dispatchEvent(
      new CustomEvent("monevo:tools:export", {
        detail: { toolId } })
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
          session_id: sessionIdRef.current });
      }

      const source =
        navSourceRef.current ||
        sessionStorage.getItem(TOOL_STORAGE_KEYS.navSource) ||
        "deep_link";
      window.gtag("event", "tool_view", {
        tool_id: currentToolId,
        tool_title: currentTitle,
        source,
        session_id: sessionIdRef.current });
      recordToolEvent("tool_open", currentToolId, { source });

      if (activeTool?.id && lastToolStored === activeTool.id) {
        const returnKey = `monevo:tools:return:${activeTool.id}`;
        if (!sessionStorage.getItem(returnKey)) {
          sessionStorage.setItem(returnKey, "true");
          window.gtag("event", "tool_return", {
            tool_id: activeTool.id,
            session_id: sessionIdRef.current });
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
        session_id: sessionId });
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <PageContainer maxWidth="4xl" layout="centered" className="py-16">
        <GlassCard
          padding="xl"
          className="flex flex-col items-center gap-4 text-center"
        >
          <h2 className="text-2xl font-semibold text-[color:var(--accent,#111827)]">
            {t("tools.authRequired.title")}
          </h2>
          <p className="max-w-xl text-sm text-[color:var(--muted-text,#6b7280)]">
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
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          {t("tools.header.kicker")}
        </p>
        <h1 className="text-2xl font-bold text-[color:var(--accent,#111827)] sm:text-3xl">
          {t("tools.header.title")}
        </h1>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)] max-w-xl mx-auto">
          {t("tools.header.subtitle")}
        </p>
      </header>

      <nav
        aria-label={t("tools.nav.ariaLabel")}
        className="w-full"
      >
        <GlassCard padding="md" className="w-full overflow-hidden">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            {t("tools.nav.browse")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-5 min-w-0">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                {t("tools.nav.hub")}
              </span>
              <Link
                to={TOOL_BASE_PATH}
                onClick={() => setNavSource("sidebar")}
                className={
                  activeSlug === "hub"
                    ? "w-fit rounded-lg px-2 py-1 text-xs font-medium transition bg-[color:var(--primary,#2563eb)]/10 text-[color:var(--primary,#2563eb)]"
                    : "w-fit rounded-lg px-2 py-1 text-xs font-medium transition text-[color:var(--muted-text,#6b7280)] hover:bg-[color:var(--primary,#2563eb)]/5 hover:text-[color:var(--primary,#2563eb)]"
                }
              >
                {t("tools.nav.hubLink")}
              </Link>
            </div>
            {toolGroups.map((group) => (
              <div key={group.id} className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {t(`tools.groups.${group.id}.title`)}
                </span>
                <div className="flex flex-col gap-1">
                  {group.tools.map((tool) => (
                    <NavLink
                      key={tool.id}
                      to={`${TOOL_BASE_PATH}/${tool.route}`}
                      onClick={() => setNavSource("sidebar")}
                      className={({ isActive }) =>
                        [
                          "w-fit rounded-lg px-2 py-1 text-xs font-medium transition",
                          isActive
                            ? "bg-[color:var(--primary,#2563eb)]/10 text-[color:var(--primary,#2563eb)]"
                            : "text-[color:var(--muted-text,#6b7280)] hover:bg-[color:var(--primary,#2563eb)]/5 hover:text-[color:var(--primary,#2563eb)]",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                    >
                      {t(`tools.entries.${tool.id}.title`)}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </nav>

      <div className="w-full space-y-6">
          <section style={{ minHeight: minViewportHeight }} className="w-full">
            <Routes>
              <Route
                index
                element={
                  <ToolsHub
                    lastTool={lastTool}
                    onNavigate={setNavSource}
                    recommendedTools={recommendedTools}
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
