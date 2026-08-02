import type { Mission } from "../types/api";

/**
 * One source of truth for how a mission renders as a compact action row.
 *
 * The server only stores progress as a percent, but users think in counts
 * ("1 of 2 lessons", not "50%"), so the fraction is reconstructed here from
 * `goal_reference` and shared by web and mobile — the two clients used to
 * derive slightly different labels from the same payload.
 */

export type MissionActionKind = "route" | "savings" | "fact" | "none";

export type MissionPresentation = {
  /** GarzoniIcon name on web; mapped to an Ionicon on mobile. */
  iconName: "bookOpen" | "chartLine" | "target" | "lightbulb" | "rocket";
  actionKind: MissionActionKind;
  /** i18n key for the CTA label; null when the row has no action. */
  ctaLabelKey: string | null;
  webRoute: string | null;
  mobileRoute: string | null;
  /** i18n key + params for the single progress line under the bar. */
  progressKey: string;
  progressParams: Record<string, string | number>;
  /** 0–100, clamped. */
  percent: number;
};

const clampPercent = (value: unknown) =>
  Math.max(0, Math.min(100, Math.round(Number(value ?? 0))));

/** Percent → "n of total", never over-reporting a step that isn't finished. */
const countFromPercent = (percent: number, total: number) =>
  Math.min(total, Math.floor((percent / 100) * total + 0.0001));

export type MissionPresentationOptions = {
  isDaily: boolean;
  /** Level-aware fallback when the mission carries no `required_lessons`. */
  lessonRequirement?: number;
};

export function getMissionPresentation(
  mission: Mission,
  { isDaily, lessonRequirement = 1 }: MissionPresentationOptions,
): MissionPresentation {
  const percent = clampPercent(mission.progress);
  const ref = (mission.goal_reference ?? {}) as Record<string, unknown>;
  const num = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  switch (mission.goal_type) {
    case "complete_lesson": {
      const total = num(ref.required_lessons, lessonRequirement);
      return {
        iconName: "bookOpen",
        actionKind: "route",
        ctaLabelKey: "missions.cta.completeLesson",
        webRoute: "/personalized-path",
        mobileRoute: "/(tabs)/learn?view=personalized",
        progressKey: "missions.progress.fraction.lessons",
        progressParams: { current: countFromPercent(percent, total), total },
        percent,
      };
    }

    case "complete_path":
      return {
        iconName: "chartLine",
        actionKind: "route",
        ctaLabelKey: "missions.cta.completePath",
        webRoute: "/personalized-path",
        mobileRoute: "/(tabs)/learn?view=personalized",
        progressKey: "missions.progress.complete",
        progressParams: { value: percent },
        percent,
      };

    case "clear_review_queue": {
      const total = num(ref.target_count, 5);
      return {
        iconName: "target",
        actionKind: "route",
        ctaLabelKey: "missions.cta.review",
        webRoute: "/exercises",
        mobileRoute: "/(tabs)/exercises",
        progressKey: "missions.progress.fraction.reviews",
        progressParams: { current: countFromPercent(percent, total), total },
        percent,
      };
    }

    case "add_savings": {
      const total = num(ref.target, isDaily ? 10 : 100);
      return {
        iconName: "rocket",
        actionKind: "savings",
        ctaLabelKey: "missions.cta.addSavings",
        webRoute: null,
        mobileRoute: null,
        progressKey: "missions.progress.fraction.savings",
        progressParams: { current: countFromPercent(percent, total), total },
        percent,
      };
    }

    case "read_fact": {
      const total = isDaily ? 1 : 5;
      return {
        iconName: "lightbulb",
        actionKind: "fact",
        ctaLabelKey: "missions.cta.readFact",
        webRoute: null,
        mobileRoute: null,
        progressKey: "missions.progress.fraction.facts",
        progressParams: { current: countFromPercent(percent, total), total },
        percent,
      };
    }

    default:
      return {
        iconName: "target",
        actionKind: "none",
        ctaLabelKey: null,
        webRoute: null,
        mobileRoute: null,
        progressKey: "missions.progress.complete",
        progressParams: { value: percent },
        percent,
      };
  }
}

/* ── Quest steps ──────────────────────────────────────────────────────────
   Seeded steps (backend/gamification/migrations/0013_seed_investor_quests.py)
   carry a `route` written as a *web* path. Pushing those onto the mobile
   router silently lands nowhere, so each step is resolved per platform from
   its type + hints and the stored route is only ever a web fallback. */

export type QuestStep = {
  id?: string;
  type?: string;
  title?: string;
  route?: string;
  completed?: boolean;
  tool_slug?: string;
  exercise_category?: string;
  course_topic?: string;
  [key: string]: unknown;
};

export type QuestStepRoute = { web: string | null; mobile: string | null };

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function resolveQuestStepRoute(step: QuestStep): QuestStepRoute {
  const fallbackWeb = str(step.route)?.startsWith("/")
    ? (str(step.route) as string)
    : null;

  switch (step.type) {
    case "lesson": {
      const topic = str(step.course_topic);
      return {
        web: topic ? `/all-topics?topic=${encodeURIComponent(topic)}` : "/all-topics",
        mobile: "/(tabs)/learn?view=personalized",
      };
    }

    case "exercise": {
      const skill = str(step.exercise_category);
      const query = skill
        ? `?skill=${encodeURIComponent(skill)}&intentReason=mission_step`
        : "?intentReason=mission_step";
      return {
        web: `/exercises${query}`,
        mobile: `/(tabs)/exercises${query}`,
      };
    }

    case "tool": {
      const slug = str(step.tool_slug);
      if (!slug) return { web: fallbackWeb, mobile: null };
      // Mobile has two routes onto the same tool screens; the tabbed one keeps
      // the tab bar, so deep links use it and the chrome stays put.
      return { web: `/tools/${slug}`, mobile: `/(tabs)/tools/${slug}` };
    }

    default:
      // Unknown step type: the stored web path may still work on web, but
      // never guess a mobile destination.
      return { web: fallbackWeb, mobile: null };
  }
}

/* ── Cycle countdown ──────────────────────────────────────────────────────
   Mission cycles roll at local midnight (daily) and local Monday 00:00
   (weekly) — see backend/gamification/services/mission_cycles.py. The clients
   compute the countdown locally rather than adding a payload field. */

export function msUntilDailyReset(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function msUntilWeeklyReset(now: Date = new Date()): number {
  const next = new Date(now);
  // getDay(): 0 = Sunday. Days until the next Monday 00:00, never 0.
  const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export type CountdownLabel = {
  /** i18n key under missions.reset.* */
  key: string;
  params: Record<string, number>;
};

/** Coarse countdown: days+hours, hours+minutes, or minutes. */
export function countdownLabel(ms: number): CountdownLabel {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return { key: "missions.reset.days", params: { days, hours } };
  if (hours > 0)
    return { key: "missions.reset.hours", params: { hours, minutes } };
  return { key: "missions.reset.minutes", params: { minutes } };
}
