/**
 * PlanReadyPage — the "Your plan is ready" segue between quiz completion and the
 * pricing page. Consumes GET /onboarding/plan-summary/ to render a personalized,
 * celebratory recap (stated goals, a 3-lesson mini path preview, a date-anchored
 * projected outcome) before sending the user to the plan options.
 *
 * If the endpoint 404s or errors (backend may not be deployed yet), it degrades
 * to a generic celebratory version with both CTAs — never a broken page.
 *
 * Rendered at /plan-ready (protected route).
 */
import React, { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GlassCard, GlassButton } from "components/ui";
import Loader from "components/common/Loader";
import { fetchPlanSummary, type PlanSummary } from "@garzoni/core";
import { recordFunnelEvent } from "services/analyticsService";

const DASHBOARD_ROUTE = "/all-topics";

const PlanReadyPage: React.FC = () => {
  const navigate = useNavigate();
  const viewTrackedRef = useRef(false);

  const {
    data: summary,
    isLoading,
    isError,
  } = useQuery<PlanSummary>({
    queryKey: ["plan-summary"],
    queryFn: fetchPlanSummary,
    retry: 0,
    staleTime: 60_000,
  });

  // Fire the view event once per mount, regardless of personalization success.
  useEffect(() => {
    if (isLoading || viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    Promise.resolve(
      recordFunnelEvent("plan_ready_view", {
        personalized: !isError && !!summary,
        recommended_tier: summary?.recommended_tier ?? null,
      })
    ).catch(() => {});
  }, [isLoading, isError, summary]);

  const recommendedTier = summary?.recommended_tier;
  const goals = summary?.stated_goals ?? [];
  const lessons = (summary?.curated_lessons ?? []).slice(0, 3);
  const outcomeText = summary?.projected_outcome?.text;

  const handleContinue = () => {
    Promise.resolve(
      recordFunnelEvent("plan_ready_continue", {
        recommended_tier: recommendedTier ?? null,
      })
    ).catch(() => {});
    // Honour the paywall-placement experiment arm (UX 3.5). Mobile already
    // defers the paywall until after the first lesson; web ignoring the flag
    // meant the arms diverged by platform and the experiment could not be read.
    if (summary?.paywall_placement === "post_first_lesson") {
      // Straight into learning; the paywall comes after the first lesson.
      // Deliberately not deep-linking a curated lesson — the web course route is
      // keyed by path/course id, not lesson id.
      navigate(DASHBOARD_ROUTE);
      return;
    }
    const params = new URLSearchParams({ from: "plan_ready" });
    if (recommendedTier) params.set("recommended", recommendedTier);
    navigate(`/subscriptions?${params.toString()}`);
  };

  const handleContinueFree = () => {
    navigate(DASHBOARD_ROUTE);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-surface-page px-4">
        <Loader message="Building your plan…" />
      </div>
    );
  }

  const hasPersonalization =
    !isError && (goals.length > 0 || lessons.length > 0 || !!outcomeText);

  return (
    <>
      <Helmet>
        <title>Your plan is ready | Garzoni</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <section
        className="min-h-screen bg-gradient-to-br from-surface-page via-surface-page to-brand-primary/5 px-4 py-10"
        aria-label="Your plan is ready"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          {/* Celebratory header */}
          <header className="space-y-3 text-center">
            <p className="text-4xl" aria-hidden="true">
              🎉
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-brand-primary)]">
              Personalized for you
            </p>
            <h1 className="text-3xl font-bold text-content-primary sm:text-4xl">
              Your plan is ready
            </h1>
            <p className="text-sm text-content-muted">
              {hasPersonalization
                ? "Here's what your answers unlocked — built around your goals."
                : "We've built a learning path around your goals. Let's get started."}
            </p>
          </header>

          {/* Stated goals as chips */}
          {goals.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {goals.map((goal) => (
                <span
                  key={goal.key}
                  className="inline-flex items-center rounded-full border border-[color:var(--color-brand-primary)]/30 bg-[color:var(--color-brand-primary)]/10 px-3 py-1.5 text-sm font-semibold text-[color:var(--color-brand-primary-hover)]"
                >
                  {goal.label}
                </span>
              ))}
            </div>
          )}

          {/* Mini path preview — 3 curated lessons as numbered steps */}
          {lessons.length > 0 && (
            <GlassCard padding="lg" className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
                Your first steps
              </h2>
              <ol className="space-y-3">
                {lessons.map((lesson, index) => (
                  <li key={lesson.id} className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-content-primary">
                        {lesson.title}
                      </p>
                      {lesson.topic && (
                        <p className="text-xs text-content-muted">
                          {lesson.topic}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </GlassCard>
          )}

          {/* Projected outcome — the emotional anchor line */}
          {outcomeText && (
            <div className="rounded-2xl border border-[color:var(--gold,#E6C87A)]/40 bg-[color:var(--gold,#E6C87A)]/10 px-5 py-4 text-center">
              <p className="text-base font-semibold text-content-primary">
                {outcomeText}
              </p>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col items-center gap-4">
            <GlassButton
              variant="primary"
              size="lg"
              className="w-full max-w-sm"
              onClick={handleContinue}
            >
              See my plan options →
            </GlassButton>
            <button
              type="button"
              onClick={handleContinueFree}
              className="text-sm font-medium text-content-muted underline-offset-2 transition hover:text-content-primary hover:underline"
            >
              Continue free
            </button>
          </div>
        </div>
      </section>
    </>
  );
};

export default PlanReadyPage;
