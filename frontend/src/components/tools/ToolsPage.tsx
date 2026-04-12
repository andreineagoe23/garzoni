import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
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
import { useTranslation } from "react-i18next";
import ToolSignalStrip, { type ToolStripToolbar } from "./ToolSignalStrip";
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

/** When no valid last-tool in session, open this route (education-first). */
const DEFAULT_TOOL_ROUTE = "next-steps";

type ToolNavSource = "sidebar" | "mobile_dropdown" | "deep_link";

function getDefaultToolRoute(): string {
  if (typeof window === "undefined") return DEFAULT_TOOL_ROUTE;
  const id = sessionStorage.getItem(TOOL_STORAGE_KEYS.lastTool);
  if (id) {
    const tool = toolsRegistry.find((t) => t.id === id);
    if (tool) return tool.route;
  }
  return DEFAULT_TOOL_ROUTE;
}

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

const ToolsIndexRedirect = () => (
  <Navigate to={`${TOOL_BASE_PATH}/${getDefaultToolRoute()}`} replace />
);

const UnknownToolRedirect = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useEffect(() => {
    toast.error(t("tools.errors.toolNotFound"));
    navigate(`${TOOL_BASE_PATH}/${getDefaultToolRoute()}`, { replace: true });
  }, [navigate, t]);
  return null;
};

const ToolView = ({ tool }: { tool: ToolDefinition }) => {
  const { t } = useTranslation();
  const toolWhoItsFor = t(`tools.entries.${tool.id}.whoItsFor`);
  const toolQuestion = t(`tools.entries.${tool.id}.questionItAnswers`);
  const toolExample = t(`tools.entries.${tool.id}.sampleUseCase`);
  const Component = tool.component;

  return (
    <div className="space-y-5 min-w-0">
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

const ToolsToolSwitcher = ({
  activeTool,
  onNavigate,
}: {
  activeTool: ToolDefinition;
  onNavigate: (source: ToolNavSource) => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeGroupTools =
    toolGroups.find((g) => g.id === activeTool.group)?.tools ?? [];

  return (
    <GlassCard padding="sm" className="w-full overflow-hidden">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
        {t("tools.workspace.switcherLabel")}
      </p>
      <div className="mb-3 hidden flex-wrap gap-2 md:flex">
        {toolGroups.map((g) => {
          const first = g.tools[0];
          if (!first) return null;
          return (
            <NavLink
              key={g.id}
              to={`${TOOL_BASE_PATH}/${first.route}`}
              onClick={() => onNavigate("sidebar")}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                activeTool.group === g.id
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
                  : "border-[color:var(--border-color)] text-content-muted hover:border-[color:var(--primary)]/40",
              ].join(" ")}
            >
              {t(`tools.groups.${g.id}.title`)}
            </NavLink>
          );
        })}
      </div>

      <div className="hidden md:block">
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
          {t(`tools.groups.${activeTool.group}.title`)}
        </p>
        <div className="space-y-1">
          {activeGroupTools.map((tool) => (
            <NavLink
              key={tool.id}
              to={`${TOOL_BASE_PATH}/${tool.route}`}
              onClick={() => onNavigate("sidebar")}
              className={({ isActive }) =>
                [
                  "flex w-full items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
                    : "border-[color:var(--border-color)] bg-[color:var(--card-bg)]/50 text-content-muted hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--primary)]/5 hover:text-[color:var(--accent)]",
                ].join(" ")
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
      </div>

      <div className="md:hidden">
        <label htmlFor="garzoni-tools-jump" className="sr-only">
          {t("tools.nav.selectTool")}
        </label>
        <select
          id="garzoni-tools-jump"
          value={activeTool.route}
          onChange={(e) => {
            onNavigate("mobile_dropdown");
            navigate(`${TOOL_BASE_PATH}/${e.target.value}`);
          }}
          className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--card-bg)] px-3 py-2 text-sm text-content-primary"
        >
          {toolsRegistry.map((tool) => (
            <option key={tool.id} value={tool.route}>
              {t(`tools.entries.${tool.id}.title`)}
            </option>
          ))}
        </select>
      </div>
    </GlassCard>
  );
};

const ToolsPage = () => {
  const { isAuthenticated } = useAuth();
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
  const activeTool = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] !== "tools") return null;
    const route = parts[1];
    if (!route) return null;
    return toolByRoute.get(route) ?? null;
  }, [location.pathname]);

  const minViewportHeight = "calc(100vh - 88px - 120px)";

  const setNavSource = (source: ToolNavSource) => {
    navSourceRef.current = source;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TOOL_STORAGE_KEYS.navSource, source);
    }
  };

  const handleReset = useCallback(
    (toolId: string) => {
      setResetNonceByTool((prev) => ({
        ...prev,
        [toolId]: (prev[toolId] ?? 0) + 1,
      }));
      toast.success(t("tools.toast.reset"));
    },
    [t]
  );

  const handleExport = useCallback((toolId: string) => {
    window.dispatchEvent(
      new CustomEvent("garzoni:tools:export", {
        detail: { toolId },
      })
    );
  }, []);

  const signalStripToolbar: ToolStripToolbar | null = useMemo(() => {
    if (!activeTool) return null;
    const toolTitle = t(`tools.entries.${activeTool.id}.title`);
    const subject = t("tools.detail.feedbackSubject", { tool: toolTitle });
    const body = t("tools.detail.feedbackBody", {
      url: typeof window !== "undefined" ? window.location.href : "",
    });
    const feedbackHref = `mailto:${TOOL_FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    return {
      feedbackHref,
      onReset: () => handleReset(activeTool.id),
      onExport: () => handleExport(activeTool.id),
      exportable: Boolean(activeTool.exportable),
    };
  }, [activeTool, t, handleReset, handleExport]);

  useEffect(() => {
    if (!activeTool?.id) {
      analyticsRef.current = { toolId: null, startedAt: Date.now() };
      return;
    }

    const currentToolId = activeTool.id;
    const currentTitle = t(`tools.entries.${activeTool.id}.title`);
    const startedAt = analyticsRef.current.startedAt;
    const previousToolId = analyticsRef.current.toolId;
    const lastToolStored =
      typeof window !== "undefined"
        ? sessionStorage.getItem(TOOL_STORAGE_KEYS.lastTool)
        : null;

    sessionStorage.setItem(TOOL_STORAGE_KEYS.lastTool, activeTool.id);

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
      innerClassName="space-y-6 w-full"
    >
      <ToolSignalStrip toolbar={signalStripToolbar} />

      <div
        className={
          activeTool !== null
            ? "flex w-full flex-col gap-6 md:flex-row md:items-start md:gap-8"
            : "w-full"
        }
      >
        {activeTool !== null && (
          <aside className="w-full shrink-0 md:w-60 md:sticky md:top-24">
            <ToolsToolSwitcher
              activeTool={activeTool}
              onNavigate={setNavSource}
            />
          </aside>
        )}

        <section
          style={{ minHeight: minViewportHeight }}
          className="w-full min-w-0 flex-1"
        >
          <Routes>
            <Route index element={<ToolsIndexRedirect />} />
            {toolsRegistry.map((tool) => (
              <Route
                key={tool.id}
                path={tool.route}
                element={
                  <ToolView
                    tool={tool}
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
