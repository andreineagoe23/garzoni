import { useMemo } from "react";
import type {
  EntitlementFeature,
  MissionBuckets,
  ProgressSummary,
} from "types/api";

type DashboardSummaryArgs = {
  progressResponse?: { data?: ProgressSummary };
  reviewQueueData?: { count?: number };
  missionsData?: MissionBuckets;
  masteryData?: {
    masteries?: Array<{
      proficiency?: number;
      skill?: string;
      level_band?: string;
      level_label?: string;
    }>;
  };
  entitlements?: { features?: Record<string, unknown> };
  profile?: { points?: number };
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
    progressData.paths?.filter(
      (p) => (p.percent_complete ?? 0) >= 99.5 || p.percent_complete === 100
    ).length || 0;
  const overallProgress = progressData.overall_progress ?? 0;
  const reviewsDue = reviewQueueData?.count ?? 0;

  // Active = not completed (not_started or in_progress); new users get not_started
  const activeMissions = useMemo(
    () => [
      ...(missionsData?.daily_missions || []).filter(
        (m) => m.status !== "completed"
      ),
      ...(missionsData?.weekly_missions || []).filter(
        (m) => m.status !== "completed"
      ),
    ],
    [missionsData]
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

  const weakestSkills = useMemo(() => {
    const masteries = masteryData?.masteries || [];
    return masteries
      .filter((m) => (m.proficiency ?? 0) < 70)
      .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))
      .slice(0, 3);
  }, [masteryData]);

  const { dailyGoalProgress, dailyGoalCurrentXP, dailyGoalTargetXP } =
    useMemo(() => {
      const targetXP = 30;
      const totalXP = profile?.points || 0;
      const currentXP = totalXP % targetXP;
      const progress = Math.min(100, (currentXP / targetXP) * 100);
      return {
        dailyGoalProgress: progress,
        dailyGoalCurrentXP: currentXP,
        dailyGoalTargetXP: targetXP,
      };
    }, [profile?.points]);

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
