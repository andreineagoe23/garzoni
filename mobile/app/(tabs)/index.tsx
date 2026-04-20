import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { href } from "../../src/navigation/href";
import {
  fetchActivityHeatmap,
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
} from "@garzoni/core";
import { ErrorState, ScreenScroll, Skeleton } from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import QuestionnaireReminderBanner from "../../src/components/dashboard/QuestionnaireReminderBanner";
import DashboardHeaderMobile from "../../src/components/dashboard/DashboardHeaderMobile";
import DashboardResumeRow from "../../src/components/dashboard/DashboardResumeRow";
import WeakSkillsQuickCardMobile from "../../src/components/dashboard/WeakSkillsQuickCardMobile";
import WeakSkillsSectionMobile from "../../src/components/dashboard/WeakSkillsSectionMobile";
import StatusSummaryGrid from "../../src/components/dashboard/StatusSummaryGrid";
import PrimaryCTAMobile, {
  type PrimaryCtaMobileData,
} from "../../src/components/dashboard/PrimaryCTAMobile";
import DashboardActivityHeatmap, {
  type ActivityCalendarMap,
  type ActivityDaySummary,
} from "../../src/components/dashboard/DashboardActivityHeatmap";
import { useAuthSession } from "../../src/auth/AuthContext";
import { useDashboardSkillExercisesNavigation } from "../../src/hooks/useDashboardSkillExercisesNavigation";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";
import TabScreenHeader from "../../src/components/navigation/TabScreenHeader";
import { HeaderAvatarButton } from "../../src/components/navigation/HeaderAvatarButton";
import { HeaderRightButtons } from "../../src/components/navigation/HeaderRightButtons";

type WeakSkill = {
  skill: string;
  proficiency: number;
  level_label?: string;
};

function planRank(plan?: string | null) {
  if (plan === "plus") return 1;
  if (plan === "pro") return 2;
  return 0;
}

/** Side-by-side resume + practice only when there is enough width for readable copy. */
const RESUME_ROW_SIDE_BY_SIDE_MIN_WIDTH = 600;

type ActivityDayRow = {
  lessons?: unknown;
  sections?: unknown;
  exercises?: unknown;
  quizzes?: unknown;
};

function normalizeCalendarDateKey(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/** `activity_calendar_by_type` must be a non-empty map of ISO dates → count objects (not `{}` alone). */
function isUsableActivityCalendarByType(
  v: unknown,
): v is Record<string, ActivityDayRow> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length === 0) return false;
  let ok = 0;
  for (const [, row] of entries) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as ActivityDayRow;
    if (
      "lessons" in r ||
      "sections" in r ||
      "exercises" in r ||
      "quizzes" in r ||
      "Lessons" in r ||
      "Sections" in r ||
      "Exercises" in r ||
      "Quizzes" in r
    ) {
      ok += 1;
      if (ok >= 2) return true;
    }
  }
  return ok >= 1;
}

function readDayCounts(row: ActivityDayRow | undefined) {
  if (!row || typeof row !== "object") {
    return { lessons: 0, sections: 0, exercises: 0, quizzes: 0 };
  }
  const lessons =
    Number(row.lessons ?? (row as { Lessons?: unknown }).Lessons ?? 0) || 0;
  const sections =
    Number(row.sections ?? (row as { Sections?: unknown }).Sections ?? 0) || 0;
  const exercises =
    Number(row.exercises ?? (row as { Exercises?: unknown }).Exercises ?? 0) ||
    0;
  const quizzes =
    Number(row.quizzes ?? (row as { Quizzes?: unknown }).Quizzes ?? 0) || 0;
  return { lessons, sections, exercises, quizzes };
}

/** `/activity-heatmap/` rows (camelCase from Django or snake_case). */
function summaryFromHeatmapApiRow(
  row: Record<string, unknown>,
): ActivityDaySummary | null {
  const date = normalizeCalendarDateKey(String(row.date ?? ""));
  if (!date) return null;
  const n = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const lessonsCompleted = n(row.lessonsCompleted ?? row.lessons_completed);
  const sectionsCompleted = n(row.sectionsCompleted ?? row.sections_completed);
  const exercisesCompleted = n(
    row.exercisesCompleted ?? row.exercises_completed,
  );
  const quizzesCompleted = n(row.quizzesCompleted ?? row.quizzes_completed);
  let totalActivities = n(row.totalActivities ?? row.total_activities);
  if (totalActivities <= 0) {
    totalActivities =
      lessonsCompleted +
      sectionsCompleted +
      exercisesCompleted +
      quizzesCompleted;
  }
  return {
    date,
    totalActivities,
    lessonsCompleted,
    sectionsCompleted,
    exercisesCompleted,
    quizzesCompleted,
  };
}

function DashboardInner() {
  const { width: windowWidth } = useWindowDimensions();
  const resumeTilesSideBySide =
    windowWidth >= RESUME_ROW_SIDE_BY_SIDE_MIN_WIDTH;
  const c = useThemeColors();
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(
    null,
  );
  const { t, i18n } = useTranslation("common");
  const { hydrated, accessToken } = useAuthSession();
  const authReady = hydrated;

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
    queryFn: () =>
      fetchReviewQueue().then(
        (r) => r.data as { count?: number; due?: Array<{ skill?: string }> },
      ),
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
    queryFn: () =>
      fetchMasterySummary().then((r) => r.data || { masteries: [] }),
    staleTime: 120_000,
    enabled: authReady && Boolean(accessToken),
  });

  const profilePayload = profileQuery.data;

  const activityHeatmapQuery = useQuery({
    queryKey: queryKeys.activityHeatmap(),
    queryFn: () => fetchActivityHeatmap(120).then((r) => r.data ?? []),
    staleTime: staleTimes.activityHeatmap,
    enabled: authReady && Boolean(accessToken),
  });

  const profile = useMemo(() => {
    if (!profilePayload) return null;
    const ud = profilePayload.user_data as Record<string, unknown> | undefined;
    if (ud && typeof ud === "object") {
      // Root `/userprofile/` fields win over mirrored `user_data` (same keys).
      return { ...ud, ...profilePayload } as UserProfile &
        Record<string, unknown>;
    }
    return profilePayload;
  }, [profilePayload]);

  const heatmapDates = useMemo<{
    firstDay: string;
    lastDay: string;
    monthLabel: string;
  }>(() => {
    const raw = profilePayload?.current_month as
      | {
          first_day?: string | null;
          last_day?: string | null;
          month_name?: string;
          year?: number | string | null;
        }
      | undefined;
    const today = new Date();
    const firstDay =
      (typeof raw?.first_day === "string" ? raw.first_day : null) ??
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    // Always use the real last day of the month so the full grid is shown
    const lastDay =
      (typeof raw?.last_day === "string" ? raw.last_day : null) ??
      (() => {
        const d = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
    const monthLabel =
      raw?.month_name && raw?.year
        ? `${raw.month_name} ${raw.year}`
        : today.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          });
    return { firstDay, lastDay, monthLabel };
  }, [profilePayload?.current_month]);

  const heatmapMap = useMemo<ActivityCalendarMap>(() => {
    const apiRows = activityHeatmapQuery.data;
    if (Array.isArray(apiRows) && apiRows.length > 0) {
      const map: ActivityCalendarMap = {};
      for (const item of apiRows) {
        const s = summaryFromHeatmapApiRow(item as Record<string, unknown>);
        if (s) map[s.date] = s;
      }
      return map;
    }

    const raw = profilePayload;
    if (!raw) return {};
    const ud = raw.user_data as Record<string, unknown> | undefined;
    const layer: UserProfile & Record<string, unknown> =
      ud && typeof ud === "object"
        ? ({ ...ud, ...raw } as UserProfile & Record<string, unknown>)
        : (raw as UserProfile & Record<string, unknown>);

    const combined =
      (raw.activity_calendar as Record<string, unknown> | undefined) ??
      (layer.activity_calendar as Record<string, unknown> | undefined);
    const byTypeRaw =
      raw.activity_calendar_by_type ?? layer.activity_calendar_by_type;
    const useByType = isUsableActivityCalendarByType(byTypeRaw);
    const byType = useByType
      ? (byTypeRaw as Record<string, ActivityDayRow>)
      : null;

    const map: ActivityCalendarMap = {};

    const upsert = (
      date: string,
      lessons: number,
      sections: number,
      exercises: number,
      quizzes: number,
      combinedTotal: number,
    ) => {
      const detailSum = lessons + sections + exercises + quizzes;
      let l = lessons;
      let s = sections;
      let e = exercises;
      let q = quizzes;
      if (combinedTotal > 0 && detailSum === 0) {
        l = combinedTotal;
      }
      const total = Math.max(combinedTotal, l + s + e + q);
      map[date] = {
        date,
        totalActivities: total,
        lessonsCompleted: l,
        sectionsCompleted: s,
        exercisesCompleted: e,
        quizzesCompleted: q,
      };
    };

    if (byType) {
      for (const [rawDate, row] of Object.entries(byType)) {
        const date = normalizeCalendarDateKey(rawDate);
        if (!date) continue;
        const c = readDayCounts(row);
        const combinedTotal =
          typeof combined?.[date] === "number"
            ? (combined[date] as number)
            : Number(combined?.[date]) || 0;
        upsert(
          date,
          c.lessons,
          c.sections,
          c.exercises,
          c.quizzes,
          combinedTotal,
        );
      }
    }

    if (combined && typeof combined === "object") {
      for (const [rawDate, val] of Object.entries(combined)) {
        const date = normalizeCalendarDateKey(rawDate);
        if (!date) continue;
        const combinedTotal = typeof val === "number" ? val : Number(val) || 0;
        if (map[date]) continue;
        if (useByType) {
          upsert(date, 0, 0, 0, 0, combinedTotal);
        } else {
          upsert(date, combinedTotal, 0, 0, 0, combinedTotal);
        }
      }
    }

    return map;
  }, [profilePayload, activityHeatmapQuery.data]);

  const entitlements = entitlementsQuery.data;
  const hasPaidProfile = Boolean(
    profile?.has_paid ??
    (profilePayload as UserProfile | undefined)?.has_paid ??
    (profilePayload?.user_data as { has_paid?: boolean } | undefined)?.has_paid,
  );
  const profilePlanId =
    profile?.subscription_plan_id ??
    (profile?.user_data as { subscription_plan_id?: string } | undefined)
      ?.subscription_plan_id ??
    null;
  const resolvedPlan: string =
    (typeof entitlements?.plan === "string" ? entitlements.plan : null) ||
    (typeof profilePlanId === "string" ? profilePlanId : null) ||
    (hasPaidProfile ? "plus" : "starter");
  const hasPlusAccess =
    planRank(resolvedPlan) >= 1 || Boolean(entitlements?.entitled);
  const hasPaid = hasPlusAccess;

  const isQuestionnaireCompleted = Boolean(
    profile?.is_questionnaire_completed ??
    (profile?.user_data as { is_questionnaire_completed?: boolean } | undefined)
      ?.is_questionnaire_completed ??
    (profilePayload as UserProfile | undefined)?.is_questionnaire_completed,
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
    progressResponse: progressQuery.data
      ? { data: progressQuery.data }
      : undefined,
    reviewQueueData: reviewQuery.data,
    missionsData: missionsQuery.data,
    masteryData: masteryQuery.data,
    entitlements,
    profile: profile ?? undefined,
  });

  const weakSkillItems = useMemo(
    () =>
      summary.weakestSkills
        .filter((s): s is WeakSkill & { skill: string } =>
          Boolean((s as WeakSkill).skill),
        )
        .map((s) => ({
          skill: s.skill,
          proficiency: s.proficiency ?? 0,
          level_label: (s as { level_label?: string }).level_label,
        })),
    [summary.weakestSkills],
  );

  const {
    handleWeakSkillClick,
    handleWeakSkillPractice,
    handleQuickCardSkillExercises,
  } = useDashboardSkillExercisesNavigation();

  const primaryCTASignal = useMemo(
    () =>
      selectPrimaryCTA(
        {
          reviewsDue: summary.reviewsDue,
          activeMissions: summary.activeMissions,
        },
        /* KPI grid already shows “Reviews due”; avoid duplicate hero CTA. */
        summary.reviewsDue > 0 ? { omitReviewsDue: true } : undefined,
      ),
    [summary.reviewsDue, summary.activeMissions],
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
          action: () => router.push(href("/missions")),
          iconName: primaryCTASignal.iconName,
          priority: "medium",
          reason: t("dashboard.cta.missionsAvailable", {
            count: primaryCTASignal.reasonCount || 0,
          }),
        };
      default:
        return {
          text: t("dashboard.cta.continueLearning"),
          action: () => router.push(href("/(tabs)/learn")),
          iconName: primaryCTASignal.iconName,
          priority: "low",
          reason: t("dashboard.cta.continueLearningReason"),
        };
    }
  }, [primaryCTASignal, t]);

  const refreshing =
    progressQuery.isFetching ||
    profileQuery.isFetching ||
    activityHeatmapQuery.isFetching ||
    missionsQuery.isFetching ||
    reviewQuery.isFetching ||
    masteryQuery.isFetching ||
    entitlementsQuery.isFetching;

  const onRefresh = useCallback(() => {
    void progressQuery.refetch();
    void profileQuery.refetch();
    void activityHeatmapQuery.refetch();
    void missionsQuery.refetch();
    void reviewQuery.refetch();
    void masteryQuery.refetch();
    void entitlementsQuery.refetch();
    void questionnaireQuery.refetch();
  }, [
    progressQuery,
    profileQuery,
    activityHeatmapQuery,
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

  const headerBar = (
    <TabScreenHeader
      title="Home"
      left={<HeaderAvatarButton />}
      right={<HeaderRightButtons />}
    />
  );

  if (!authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {headerBar}
        <ScreenScroll
          contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
        >
          <Skeleton
            width="60%"
            height={28}
            style={{ marginBottom: spacing.lg }}
          />
          <Skeleton
            width="100%"
            height={100}
            style={{ marginBottom: spacing.md }}
          />
        </ScreenScroll>
      </View>
    );
  }

  if (!accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {headerBar}
        <ScreenScroll
          contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
        >
          <Text style={[styles.greeting, { color: c.text }]}>
            {t("dashboard.header.welcomeBack")}
          </Text>
          <Text style={{ color: c.textMuted, marginBottom: spacing.lg }}>
            Sign in on the Profile tab to see your dashboard.
          </Text>
        </ScreenScroll>
      </View>
    );
  }

  if (progressQuery.isPending || profileQuery.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {headerBar}
        <ScreenScroll
          contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
        >
          <Skeleton
            width="60%"
            height={28}
            style={{ marginBottom: spacing.lg }}
          />
          <Skeleton
            width="100%"
            height={88}
            style={{ marginBottom: spacing.md }}
          />
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <Skeleton width={158} height={120} />
            <Skeleton width={158} height={120} />
            <Skeleton width={158} height={120} />
          </View>
          <Skeleton
            width="100%"
            height={100}
            style={{ marginBottom: spacing.md }}
          />
          <Skeleton
            width="100%"
            height={100}
            style={{ marginBottom: spacing.md }}
          />
        </ScreenScroll>
      </View>
    );
  }

  if (progressQuery.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {headerBar}
        <ErrorState
          message={t("screenErrors.loadDashboard")}
          onRetry={() => void progressQuery.refetch()}
          onReport={() => router.push("/feedback")}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {headerBar}
      <ScreenScroll
        contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
      >
        <View style={styles.stack}>
          <DashboardHeaderMobile displayName={displayName || undefined} />

          {!questionnaireCompletedForUi ? (
            <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
              <QuestionnaireReminderBanner
                hasPaid={hasPaid}
                authReady={authReady && Boolean(accessToken)}
              />
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
                style={[
                  styles.resumeCol,
                  !resumeTilesSideBySide && styles.resumeColFullWidth,
                ]}
              >
                <DashboardResumeRow
                  style={
                    !resumeTilesSideBySide
                      ? styles.resumeCardFullWidth
                      : styles.resumeCardFill
                  }
                  resume={summary.resume}
                  startHere={summary.startHere}
                />
              </View>
              <View
                style={[
                  styles.resumeCol,
                  !resumeTilesSideBySide && styles.resumeColFullWidth,
                ]}
              >
                <WeakSkillsQuickCardMobile
                  style={
                    !resumeTilesSideBySide
                      ? styles.resumeCardFullWidth
                      : styles.resumeCardFill
                  }
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

          <View
            style={[
              styles.heatmapCard,
              { backgroundColor: c.surfaceOffset, borderColor: c.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Your consistency
            </Text>
            <Text style={[styles.sectionSub, { color: c.textMuted }]}>
              {heatmapDates.monthLabel}
            </Text>
            <DashboardActivityHeatmap
              activityMap={heatmapMap}
              firstDay={heatmapDates.firstDay}
              lastDay={heatmapDates.lastDay}
              colors={c}
              selectedDate={selectedHeatmapDay}
              onDaySelected={(s) =>
                setSelectedHeatmapDay((prev) =>
                  prev === (s?.date ?? null) ? null : (s?.date ?? null),
                )
              }
            />
          </View>

          <StatusSummaryGrid
            coursesCompleted={summary.coursesCompleted}
            overallProgress={summary.overallProgress}
            reviewsDue={summary.reviewsDue}
            activeMissionsCount={summary.activeMissions.length}
            dailyGoalProgress={summary.dailyGoalProgress}
            streakCount={Number(profile?.streak ?? 0)}
            streakMeta={profile?.streak_meta}
            reviewError={reviewQuery.isError ? reviewQuery.error : undefined}
            missionsError={
              missionsQuery.isError ? missionsQuery.error : undefined
            }
            refetchReview={() => void reviewQuery.refetch()}
            refetchMissions={() => void missionsQuery.refetch()}
            onOpenReviews={() => router.push(href("/(tabs)/exercises"))}
            onOpenMissions={() => router.push(href("/missions"))}
            locale={i18n.language}
          />

          <PrimaryCTAMobile primaryCTA={primaryCTA} />
        </View>
      </ScreenScroll>
    </View>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  greeting: {
    fontSize: typography.xl,
    fontWeight: "700",
    marginBottom: spacing.lg,
  },
  heatmapCard: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: "700",
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: typography.xs,
    marginBottom: spacing.md,
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
});
