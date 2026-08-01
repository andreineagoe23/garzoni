import { Link } from "react-router-dom";
import { getToolLearningHook } from "@garzoni/core";
import { recordToolEvent } from "services/toolsAnalytics";

type Props = {
  toolSlug: string;
};

export default function WhyThisMatters({ toolSlug }: Props) {
  const hook = getToolLearningHook(toolSlug);
  if (!hook) return null;

  return (
    <div className="app-card app-card--pad-sm border border-[color:var(--color-brand-primary)]/15 bg-[color:var(--color-brand-primary)]/5">
      <p className="app-eyebrow mb-1">{hook.title}</p>
      <p className="text-sm text-content-muted">{hook.explainer}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={hook.lessonRoute}
          onClick={() =>
            recordToolEvent("tool_to_lesson_click", toolSlug, {
              href: hook.lessonRoute,
              source: "why_this_matters",
            })
          }
          className="rounded-full border border-[color:var(--color-brand-primary)]/30 px-3 py-1.5 text-xs font-semibold text-[color:var(--color-brand-primary-hover)] transition hover:bg-[color:var(--color-brand-primary)] hover:text-white"
        >
          Learn the concept
        </Link>
        <Link
          to={hook.exerciseRoute}
          onClick={() =>
            recordToolEvent("tool_to_exercise_click", toolSlug, {
              href: hook.exerciseRoute,
              source: "why_this_matters",
            })
          }
          className="rounded-full bg-[color:var(--color-brand-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
        >
          Practice this skill
        </Link>
      </div>
    </div>
  );
}
