import { useMemo } from "react";
import type { MissionBuckets, ProgressSummary } from "types/api";

type DashboardSummaryArgs = {
  progressResponse?: { data?: ProgressSummary };
  reviewQueueData?: { count?: number };
  missionsData?: MissionBuckets;
  masteryData?: { masteries?: Array<{ proficiency?: number; skill?: string }> };
  entitlements?: { features?: Record<string, unknown> };
  profile?: { points?: number };
};

export const useDashboardSummary = ({
  progressResponse,
  reviewQueueData,
  missionsData,
  masteryData,
  entitlements,
  profile }: DashboardSummaryArgs) => {
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
    return Object.values(features)
      .map(
        (feature: {
          flag?: string;
          name?: string;
          enabled?: boolean;
          used_today?: number;
          remaining_today?: number;
        }) => ({
          key: feature.flag || feature.name,
          name: feature.name,
          enabled: feature.enabled,
          used: feature.used_today,
          remaining: feature.remaining_today })
      )
      .filter((feature) => feature.name && feature.enabled !== false);
  }, [entitlements?.features]);

  const weakestSkills = useMemo(() => {
    const masteries = masteryData?.masteries || [];
    return masteries
      .filter((m) => (m.proficiency ?? 0) < 70)
      .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))
      .slice(0, 3);
  }, [masteryData]);

  const dailyGoalProgress = useMemo(() => {
    const targetXP = 30;
    const currentXP = profile?.points || 0;
    return Math.min(100, ((currentXP % targetXP) / targetXP) * 100);
  }, [profile?.points]);

  const resume = progressData.resume ?? null;
  const startHere = progressData.start_here ?? null;

  return {
    coursesCompleted,
    overallProgress,
    reviewsDue,
    activeMissions,
    entitlementUsage,
    weakestSkills,
    dailyGoalProgress,
    resume,
    startHere };
};
