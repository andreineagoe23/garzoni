import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { href } from "../../src/navigation/href";
import {
  fetchEntitlements,
  fetchMasterySummary,
  fetchMissions,
  fetchProfile,
  fetchProgressSummary,
  fetchQuestionnaireProgress,
  fetchReviewQueue,
  queryKeys,
  selectPrimaryCTA,
  staleTimes,
  useDashboardSummary,
  type Entitlements,
  type UserProfile,
} from "@monevo/core";
import { ErrorState, ScreenScroll, Skeleton } from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import QuestionnaireReminderBanner from "../../src/components/dashboard/QuestionnaireReminderBanner";
import AllTopicsGrid from "../../src/components/dashboard/AllTopicsGrid";
import DashboardHeaderMobile from "../../src/components/dashboard/DashboardHeaderMobile";
import DashboardResumeRow from "../../src/components/dashboard/DashboardResumeRow";
import WeakSkillsQuickCardMobile from "../../src/components/dashboard/WeakSkillsQuickCardMobile";
import WeakSkillsSectionMobile from "../../src/components/dashboard/WeakSkillsSectionMobile";
import StatusSummaryGrid from "../../src/components/dashboard/StatusSummaryGrid";
import PrimaryCTAMobile, {
  type PrimaryCtaMobileData,
} from "../../src/components/dashboard/PrimaryCTAMobile";
import PersonalizedPathContentMobile from "../../src/components/dashboard/PersonalizedPathContentMobile";
import { useAuthSession } from "../../src/auth/AuthContext";
import { useDashboardSkillExercisesNavigation } from "../../src/hooks/useDashboardSkillExercisesNavigation";
import { useThemeColors } from "../../src/theme/ThemeContext";
import GlassCard from "../../src/components/ui/GlassCard";
import GlassButton from "../../src/components/ui/GlassButton";
import { spacing, typography } from "../../src/theme/tokens";

type WeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

type ActivePage = "all-topics" | "personalized-path";

function planRank(plan?: string | null) {
  if (plan === "plus") return 1;
  if (plan === "pro") return 2;
  return 0;
}

/** Side-by-side resume + practice only when there is enough width for readable copy. */
const RESUME_ROW_SIDE_BY_SIDE_MIN_WIDTH = 600;

function DashboardInner() {
  const { width: windowWidth } = useWindowDimensions();
  const resumeTilesSideBySide = windowWidth >= RESUME_ROW_SIDE_BY_SIDE_MIN_WIDTH;
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const { hydrated, accessToken } = useAuthSession();
  const authReady = hydrated;
  const [activePage, setActivePage] = useState<ActivePage>("all-topics");
  const { segment, tab } = useLocalSearchParams<{
    segment?: string;
    tab?: string;
  }>();

  useEffect(() => {
    const raw = String(segment ?? tab ?? "").toLowerCase();
    if (raw === "personalized" || raw === "personalized-path") {
      setActivePage("personalized-path");
    }
  }, [segment, tab]);

  const progressQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () => fetchProgressSummary().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
    enabled: authReady && Boolean(accessToken),
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data as UserProfile),
    staleTime: staleTimes.profile,
    enabled: authReady && Boolean(accessToken),
  });

  const entitlementsQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data as Entitlements),
    staleTime: staleTimes.entitlements,
    enabled: authReady && Boolean(accessToken),
  });

  const questionnaireQuery = useQuery({
    queryKey: queryKeys.questionnaireProgress(),
    queryFn: fetchQuestionnaireProgress,
    staleTime: 0,
    refetchOnMount: true,
    enabled: authReady && Boolean(accessToken),
  });

  const reviewQuery = useQuery({
    queryKey: queryKeys.reviewQueue(),
    queryFn: () => fetchReviewQueue().then((r) => r.data as { count?: number; due?: Array<{ skill?: string }> }),
    staleTime: staleTimes.progressSummary,
    enabled: authReady && Boolean(accessToken),
  });

  const missionsQuery = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => fetchMissions().then((r) => r.data),
    staleTime: 60_000,
    enabled: authReady && Boolean(accessToken),
  });

  const masteryQuery = useQuery({
    queryKey: queryKeys.masterySummary(),
    queryFn: () => fetchMasterySummary().then((r) => r.data || { masteries: [] }),
    staleTime: 120_000,
    enabled: authReady && Boolean(accessToken),
  });

  const profilePayload = profileQuery.data;
  const profile = useMemo(() => {
    if (!profilePayload) return null;
    const ud = profilePayload.user_data as Record<string, unknown> | undefined;
    if (ud && typeof ud === "object") {
      return { ...profilePayload, ...ud } as UserProfile & Record<string, unknown>;
    }
    return profilePayload;
  }, [profilePayload]);

  const entitlements = entitlementsQuery.data;
  const hasPaidProfile = Boolean(
    profile?.has_paid ??
      (profilePayload as UserProfile | undefined)?.has_paid ??
      (profilePayload?.user_data as { has_paid?: boolean } | undefined)?.has_paid
  );
  const profilePlanId =
    profile?.subscription_plan_id ??
    (profile?.user_data as { subscription_plan_id?: string } | undefined)?.subscription_plan_id ??
    null;
  const resolvedPlan: string =
    (typeof entitlements?.plan === "string" ? entitlements.plan : null) ||
    (typeof profilePlanId === "string" ? profilePlanId : null) ||
    (hasPaidProfile ? "plus" : "starter");
  const hasPlusAccess = planRank(resolvedPlan) >= 1 || Boolean(entitlements?.entitled);
  const hasPaid = hasPlusAccess;

  const isQuestionnaireCompleted = Boolean(
    profile?.is_questionnaire_completed ??
      (profile?.user_data as { is_questionnaire_completed?: boolean } | undefined)
        ?.is_questionnaire_completed ??
      (profilePayload as UserProfile | undefined)?.is_questionnaire_completed
  );

  const questionnaireProgress = questionnaireQuery.data;
  const questionnaireCompletedForUi =
    isQuestionnaireCompleted || questionnaireProgress?.status === "completed";

  useEffect(() => {
    if (!authReady || !accessToken) return;
    if (hasPlusAccess) return;
    if (
      !questionnaireQuery.isFetched ||
      questionnaireQuery.isPending ||
      questionnaireQuery.isFetching
    )
      return;
    if (!questionnaireProgress) return;
    if (questionnaireProgress.status === "completed") return;
    if (questionnaireProgress.status === "abandoned") return;
    router.replace(href("/onboarding"));
  }, [
    authReady,
    accessToken,
    hasPlusAccess,
    questionnaireQuery.isFetched,
    questionnaireQuery.isPending,
    questionnaireQuery.isFetching,
    questionnaireProgress,
  ]);

  const summary = useDashboardSummary({
    progressResponse: progressQuery.data ? { data: progressQuery.data } : undefined,
    reviewQueueData: reviewQuery.data,
    missionsData: missionsQuery.data,
    masteryData: masteryQuery.data,
    entitlements,
    profile: profile ?? undefined,
  });

  const weakSkillItems = useMemo(
    () =>
      summary.weakestSkills
        .filter((s): s is WeakSkill & { skill: string } => Boolean((s as WeakSkill).skill))
        .map((s) => ({
          skill: s.skill,
          proficiency: s.proficiency ?? 0,
          level_label: (s as { level_label?: string }).level_label,
        })),
    [summary.weakestSkills]
  );

  const {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleQuickCardSkillExercises,
  } = useDashboardSkillExercisesNavigation();

  const primaryCTASignal = useMemo(
    () => selectPrimaryCTA({ reviewsDue: summary.reviewsDue, activeMissions: summary.activeMissions }),
    [summary.reviewsDue, summary.activeMissions]
  );

  const primaryCTA = useMemo<PrimaryCtaMobileData | null>(() => {
    if (!primaryCTASignal) return null;
    if (primaryCTASignal.type === "continue_lesson") return null;

    switch (primaryCTASignal.type) {
      case "reviews_due":
        return {
          text: t("dashboard.cta.doReviews"),
          action: () => router.push(href("/(tabs)/exercises")),
          iconName: primaryCTASignal.iconName,
          priority: "high",
          reason: t("dashboard.cta.reviewsDue", {
            count: primaryCTASignal.reasonCount || 0,
          }),
        };
      case "start_mission":
        return {
          text: t("dashboard.cta.startMission"),
          action: () => router.push(href("/(tabs)/missions")),
          iconName: primaryCTASignal.iconName,
          priority: "medium",
          reason: t("dashboard.cta.missionsAvailable", {
            count: primaryCTASignal.reasonCount || 0,
          }),
        };
      default:
        return {
          text: t("dashboard.cta.continueLearning"),
          action: () => {
            setActivePage("all-topics");
            router.push("/(tabs)/learn");
          },
          iconName: primaryCTASignal.iconName,
          priority: "low",
          reason: t("dashboard.cta.continueLearningReason"),
        };
    }
  }, [primaryCTASignal, t]);

  const refreshing =
    progressQuery.isFetching ||
    profileQuery.isFetching ||
    missionsQuery.isFetching ||
    reviewQuery.isFetching ||
    masteryQuery.isFetching ||
    entitlementsQuery.isFetching;

  const onRefresh = useCallback(() => {
    void progressQuery.refetch();
    void profileQuery.refetch();
    void missionsQuery.refetch();
    void reviewQuery.refetch();
    void masteryQuery.refetch();
    void entitlementsQuery.refetch();
    void questionnaireQuery.refetch();
  }, [
    progressQuery,
    profileQuery,
    missionsQuery,
    reviewQuery,
    masteryQuery,
    entitlementsQuery,
    questionnaireQuery,
  ]);

  const displayName =
    (profile?.first_name as string | undefined)?.trim() ||
    (profile?.username as string | undefined)?.trim() ||
    "";

  const handlePersonalizedPathClick = useCallback(() => {
    if (hasPlusAccess) {
      setActivePage("personalized-path");
      return;
    }
    if (!isQuestionnaireCompleted) {
      router.push(href("/onboarding"));
      return;
    }
    router.push(href("/subscriptions"));
  }, [hasPlusAccess, isQuestionnaireCompleted]);

  const reviewTopSkill = reviewQuery.data?.due?.[0]?.skill ?? null;

  if (!authReady) {
    return (
      <ScreenScroll contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <Skeleton width="60%" height={28} style={{ marginBottom: spacing.lg }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
      </ScreenScroll>
    );
  }

  if (!accessToken) {
    return (
      <ScreenScroll contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <Text style={[styles.greeting, { color: c.text }]}>{t("dashboard.header.welcomeBack")}</Text>
        <Text style={{ color: c.textMuted, marginBottom: spacing.lg }}>
          Sign in on the Profile tab to see your dashboard.
        </Text>
      </ScreenScroll>
    );
  }

  if (progressQuery.isPending || profileQuery.isPending) {
    return (
      <ScreenScroll contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
        <Skeleton width="60%" height={28} style={{ marginBottom: spacing.lg }} />
        <Skeleton width="100%" height={88} style={{ marginBottom: spacing.md }} />
        <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg }}>
          <Skeleton width={158} height={120} />
          <Skeleton width={158} height={120} />
          <Skeleton width={158} height={120} />
        </View>
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
        <Skeleton width="100%" height={100} style={{ marginBottom: spacing.md }} />
      </ScreenScroll>
    );
  }

  if (progressQuery.isError) {
    return (
      <ErrorState
        message="Could not load your dashboard."
        onRetry={() => void progressQuery.refetch()}
      />
    );
  }

  const navigationButtons = (
    <View style={styles.segmentRow}>
      <GlassButton
        variant={activePage === "all-topics" ? "active" : "ghost"}
        size="sm"
        onPress={() => setActivePage("all-topics")}
      >
        {t("dashboard.nav.allTopics")}
      </GlassButton>
      <View style={styles.segmentPersonalized}>
        <GlassButton
          variant={activePage === "personalized-path" ? "active" : "ghost"}
          size="sm"
          onPress={handlePersonalizedPathClick}
          disabled={profileQuery.isPending || profileQuery.isFetching}
        >
          {t("dashboard.nav.personalizedPath")}
        </GlassButton>
        {!isQuestionnaireCompleted ? (
          <View style={[styles.onboardingBadge, { backgroundColor: `${c.error}22` }]}>
            <Text style={[styles.onboardingBadgeText, { color: c.error }]} numberOfLines={1}>
              {t("dashboard.nav.completeOnboarding")}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenScroll
      contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
      }
    >
      <GlassCard padding="lg" style={{ borderColor: c.border, marginBottom: spacing.lg }}>
        <DashboardHeaderMobile displayName={displayName || undefined} />

        {!questionnaireCompletedForUi ? (
          <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
            <QuestionnaireReminderBanner hasPaid={hasPaid} authReady={authReady && Boolean(accessToken)} />
          </View>
        ) : null}

        {questionnaireCompletedForUi ? (
          <View
            style={[
              styles.resumeRow,
              !resumeTilesSideBySide && styles.resumeRowStacked,
            ]}
          >
            <View
              style={[styles.resumeCol, !resumeTilesSideBySide && styles.resumeColFullWidth]}
            >
              <DashboardResumeRow
                style={!resumeTilesSideBySide ? styles.resumeCardFullWidth : styles.resumeCardFill}
                resume={summary.resume}
                startHere={summary.startHere}
              />
            </View>
            <View
              style={[styles.resumeCol, !resumeTilesSideBySide && styles.resumeColFullWidth]}
            >
              <WeakSkillsQuickCardMobile
                style={!resumeTilesSideBySide ? styles.resumeCardFullWidth : styles.resumeCardFill}
                locale={i18n.language}
                topSkill={weakSkillItems[0] ?? null}
                onRecommendedSkillExercises={handleQuickCardSkillExercises}
                onOpenExercises={() => router.push(href("/(tabs)/exercises"))}
              />
            </View>
          </View>
        ) : (
          <WeakSkillsQuickCardMobile
            locale={i18n.language}
            topSkill={weakSkillItems[0] ?? null}
            onRecommendedSkillExercises={handleQuickCardSkillExercises}
            onOpenExercises={() => router.push(href("/(tabs)/exercises"))}
          />
        )}

        <WeakSkillsSectionMobile
          show
          masteryError={masteryQuery.isError ? masteryQuery.error : undefined}
          weakestSkills={weakSkillItems}
          hasAnyMasteryData={(masteryQuery.data?.masteries?.length ?? 0) > 0}
          refetchMastery={() => void masteryQuery.refetch()}
          locale={i18n.language}
          completedSections={summary.completedSections}
          totalSections={summary.totalSections}
          completedLessons={summary.completedLessons}
          totalLessons={summary.totalLessons}
          onSkillClick={handleWeakSkillClick}
          onPracticeClick={handleWeakSkillPractice}
        />

        <StatusSummaryGrid
          coursesCompleted={summary.coursesCompleted}
          overallProgress={summary.overallProgress}
          reviewsDue={summary.reviewsDue}
          activeMissionsCount={summary.activeMissions.length}
          dailyGoalProgress={summary.dailyGoalProgress}
          streakCount={Number(profile?.streak ?? 0)}
          reviewError={reviewQuery.isError ? reviewQuery.error : undefined}
          missionsError={missionsQuery.isError ? missionsQuery.error : undefined}
          refetchReview={() => void reviewQuery.refetch()}
          refetchMissions={() => void missionsQuery.refetch()}
          reviewTopSkill={reviewTopSkill}
          onOpenReviews={() => router.push(href("/(tabs)/exercises"))}
          onOpenMissions={() => router.push(href("/(tabs)/missions"))}
          locale={i18n.language}
        />

        <PrimaryCTAMobile primaryCTA={primaryCTA} />
      </GlassCard>

      {navigationButtons}

      {activePage === "all-topics" ? (
        <AllTopicsGrid />
      ) : (
        <PersonalizedPathContentMobile
          onCourseClick={(courseId) => {
            router.push(`/flow/${courseId}`);
          }}
        />
      )}
    </ScreenScroll>
  );
}

export default function DashboardScreen() {
  return (
    <TabErrorBoundary>
      <DashboardInner />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  greeting: {
    fontSize: typography.xl,
    fontWeight: "700",
    marginBottom: spacing.lg,
  },
  resumeRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: spacing.md,
    marginTop: spacing.md,
    alignItems: "stretch",
  },
  resumeRowStacked: {
    flexDirection: "column",
  },
  resumeCol: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
  },
  resumeColFullWidth: {
    alignSelf: "stretch",
  },
  resumeCardFill: {
    flex: 1,
    alignSelf: "stretch",
  },
  resumeCardFullWidth: {
    width: "100%",
    alignSelf: "stretch",
    flexGrow: 0,
  },
  segmentRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  segmentPersonalized: { flex: 1, minWidth: 140, gap: spacing.xs },
  onboardingBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  onboardingBadgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
});
