import { useMemo } from "react";
import type {
  EntitlementFeature,
  MissionBuckets,
  ProgressSummary,
} from "types/api";
import { computeCourseProgress } from "../lib/courseProgress";

type DashboardSummaryArgs = {
  progressResponse?: { data?: ProgressSummary };
  reviewQueueData?: { count?: number };
  missionsData?: MissionBuckets;
  masteryData?: {
    masteries?: Array<{
      proficiency?: number;
      skill?: string;
      course_id?: number | null;
      course_title?: string | null;
      level_band?: string;
      level_label?: string;
      due_at?: string | null;
      last_reviewed?: string | null;
      is_due_now?: boolean;
      overdue_days?: number | null;
      delta_7d?: number | null;
      weakness_score?: number;
      recommended_action?: "review" | "practice" | "lesson";
      review_exercise_id?: number | null;
      next_step?: {
        type: "review" | "lesson" | "quiz" | "practice" | "tutor";
        target_id: number | null;
        course_id: number | null;
        title: string | null;
      } | null;
    }>;
  };
  entitlements?: { features?: Record<string, unknown> };
  profile?: {
    points?: number;
    daily_goal?: {
      target_xp?: number;
      earned_xp_today?: number;
      progress_pct?: number;
    };
  };
};

export const useDashboardSummary = ({
  progressResponse,
  reviewQueueData,
  missionsData,
  masteryData,
  entitlements,
  profile,
}: DashboardSummaryArgs) => {
  const progressData = progressResponse?.data || {};

  const coursesCompleted =
    progressData.paths?.filter((p) => computeCourseProgress(p).isComplete)
      .length || 0;
  const overallProgress = progressData.overall_progress ?? 0;
  const reviewsDue = reviewQueueData?.count ?? 0;

  // Active = not completed (not_started or in_progress); new users get not_started
  const activeMissions = useMemo(
    () => [
      ...(missionsData?.daily_missions || []).filter(
        (m) => m.status !== "completed",
      ),
      ...(missionsData?.weekly_missions || []).filter(
        (m) => m.status !== "completed",
      ),
    ],
    [missionsData],
  );

  const entitlementUsage = useMemo(() => {
    const features = entitlements?.features || {};
    return (Object.values(features) as EntitlementFeature[])
      .map((feature) => ({
        key: feature.flag || feature.name,
        name: feature.name,
        enabled: feature.enabled,
        used: feature.used_today,
        remaining: feature.remaining_today,
      }))
      .filter((feature) => feature.name && feature.enabled !== false);
  }, [entitlements?.features]);

  // Backend ranks by personalized weakness_score; we surface up to 3 meaningful areas.
  const weakestSkills = useMemo(() => {
    const masteries = masteryData?.masteries || [];
    const meaningful = masteries.filter((m) => {
      if (m.is_due_now) return true;
      if ((m.delta_7d ?? 0) < -3) return true;
      return (m.proficiency ?? 0) < 70;
    });
    return meaningful.slice(0, 3);
  }, [masteryData]);

  const strongestSkills = useMemo(() => {
    const masteries = masteryData?.masteries || [];
    return [...masteries]
      .sort((a, b) => (b.proficiency ?? 0) - (a.proficiency ?? 0))
      .slice(0, 3);
  }, [masteryData]);

  const { dailyGoalProgress, dailyGoalCurrentXP, dailyGoalTargetXP } =
    useMemo(() => {
      const dg = profile?.daily_goal;
      if (
        dg &&
        typeof dg.target_xp === "number" &&
        dg.target_xp > 0 &&
        typeof dg.earned_xp_today === "number"
      ) {
        return {
          dailyGoalProgress: Math.min(100, dg.progress_pct ?? 0),
          dailyGoalCurrentXP: dg.earned_xp_today,
          dailyGoalTargetXP: dg.target_xp,
        };
      }
      const targetXP = 30;
      const totalXP = profile?.points || 0;
      const currentXP = totalXP % targetXP;
      const progress = Math.min(100, (currentXP / targetXP) * 100);
      return {
        dailyGoalProgress: progress,
        dailyGoalCurrentXP: currentXP,
        dailyGoalTargetXP: targetXP,
      };
    }, [profile?.points, profile?.daily_goal]);

  const resume = progressData.resume ?? null;
  const startHere = progressData.start_here ?? null;
  const completedSections = progressData.completed_sections ?? 0;
  const totalSections = progressData.total_sections ?? 0;
  const completedLessons = progressData.completed_lessons ?? 0;
  const totalLessons = progressData.total_lessons ?? 0;

  return {
    coursesCompleted,
    overallProgress,
    reviewsDue,
    activeMissions,
    entitlementUsage,
    weakestSkills,
    strongestSkills,
    dailyGoalProgress,
    dailyGoalCurrentXP,
    dailyGoalTargetXP,
    resume,
    startHere,
    completedSections,
    totalSections,
    completedLessons,
    totalLessons,
  };
};
