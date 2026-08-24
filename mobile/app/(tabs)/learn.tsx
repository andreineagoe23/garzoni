import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useScrollToTop } from "@react-navigation/native";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  courseService,
  fetchEntitlements,
  fetchProfile,
  fetchProgressSummary,
  fetchQuestionnaireProgress,
  pathService,
  queryKeys,
  staleTimes,
  type Entitlements,
  type UserProfile,
} from "@garzoni/core";
import { ErrorState, SelectMenu, Skeleton } from "../../src/components/ui";
import GlassCard from "../../src/components/ui/GlassCard";
import GlassButton from "../../src/components/ui/GlassButton";
import CourseCard from "../../src/components/learn/CourseCard";
import PathSceneHeader from "../../src/components/learn/PathSceneHeader";
import ContinueLearningCard from "../../src/components/learn/ContinueLearningCard";
import PersonalizedPathContentMobile from "../../src/components/dashboard/PersonalizedPathContentMobile";
import JourneyMapContent from "../../src/components/journey/JourneyMapContent";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { useAuthSession } from "../../src/auth/AuthContext";
import { href } from "../../src/navigation/href";
import { unwrapApiList } from "../../src/lib/unwrapApiList";
import {
  applyPathSortAndFilter,
  pathProgressPercent,
} from "../../src/lib/pathProgress";
import { useThemeColors } from "../../src/theme/ThemeContext";
import type { ThemeColors } from "../../src/theme/palettes";
import { layout, radius, spacing, typography } from "../../src/theme/tokens";
import { useResponsive } from "../../src/utils/platform";
import TabScreenHeader from "../../src/components/navigation/TabScreenHeader";
import { HeaderAvatarButton } from "../../src/components/navigation/HeaderAvatarButton";
import { HeaderRightButtons } from "../../src/components/navigation/HeaderRightButtons";

type LearnActiveView = "all-topics" | "personalized-path";

function planRank(plan?: string | null) {
  if (plan === "plus") return 1;
  if (plan === "pro") return 2;
  return 0;
}

type CourseRow = {
  id?: number;
  title?: string;
  name?: string;
  short_description?: string;
  completed_lessons?: number;
  total_lessons?: number;
  lesson_count?: number;
  image?: string;
};

type PathRow = {
  id?: number;
  title?: string;
  name?: string;
  description?: string;
  image?: string;
  /** From API: path requires a higher plan than the user has */
  is_locked?: boolean;
  /** Included on GET /paths/ — use when /courses/?path= is slow or fails */
  courses?: CourseRow[];
};

function courseTotalLessons(c: CourseRow): number {
  return c.total_lessons ?? c.lesson_count ?? 0;
}

type FilterMode = "all" | "in_progress" | "completed";
const LEARNING_PATHS_STALE_MS = 60_000;

function createLearnStyles(c: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      backgroundColor: c.bg,
    },
    headerPad: {
      paddingTop: spacing.xs,
    },
    loadingWrap: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: c.bg,
    },
    headerBlock: { marginBottom: spacing.md },
    heading: {
      fontSize: typography.xl,
      fontWeight: "700",
      color: c.text,
      marginBottom: spacing.md,
    },
    search: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: typography.base,
      color: c.text,
      backgroundColor: c.surface,
      marginBottom: spacing.md,
    },
    filterRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: "flex-start",
    },
    filterHalf: { flex: 1, minWidth: 0 },
    pathTitle: {
      fontSize: typography.lg,
      fontWeight: "700",
      color: c.text,
    },
    pathDesc: {
      fontSize: typography.sm,
      color: c.textMuted,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    expandHint: {
      fontSize: typography.xs,
      color: c.primary,
      fontWeight: "600",
      marginTop: spacing.md,
    },
    progressMeta: {
      fontSize: typography.xs,
      fontWeight: "600",
      marginTop: spacing.sm,
    },
    coursesList: {
      marginTop: spacing.sm,
      paddingLeft: spacing.md,
      gap: spacing.sm,
    },
    error: { color: c.error, fontSize: typography.sm },
    segmentRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
      alignItems: "flex-start",
    },
    segmentItem: { flex: 1, minWidth: 0, gap: spacing.xs },
    segmentBtn: { width: "100%" },
    onboardingBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: 999,
    },
    onboardingBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    personalizedLoading: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    modeRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.sm,
    },
  });
}

function LearnInner() {
  const c = useThemeColors();
  const styles = useMemo(() => createLearnStyles(c), [c]);
  const { isTablet, gutter } = useResponsive();
  const screenPad = layout.screenPaddingX + (isTablet ? gutter : 0);
  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingHorizontal: screenPad }],
    [styles.listContent, screenPad],
  );
  const queryClient = useQueryClient();
  const { hydrated, accessToken } = useAuthSession();
  const { t } = useTranslation("common");

  const [activeView, setActiveView] = useState<LearnActiveView>("all-topics");
  const [personalizedMode, setPersonalizedMode] = useState<"journey" | "list">(
    "journey",
  );
  const { expandPath, view, session_id } = useLocalSearchParams<{
    expandPath?: string;
    view?: string;
    session_id?: string | string[];
    redirect?: string | string[];
  }>();

  const sessionId =
    session_id == null
      ? undefined
      : Array.isArray(session_id)
        ? session_id[0]
        : session_id;

  const webCheckoutReturnHandled = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const v = String(view ?? "").toLowerCase();
    if (v === "personalized" || v === "personalized-path") {
      setActiveView("personalized-path");
    }
  }, [view]);

  /** Web-only checkout return: refresh identity data once when a session_id comes back. */
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!sessionId || !hydrated || !accessToken) return;
    if (webCheckoutReturnHandled.current === sessionId) return;
    webCheckoutReturnHandled.current = sessionId;
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.entitlements() });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.questionnaireProgress(),
    });
  }, [sessionId, hydrated, accessToken, queryClient]);

  const [expandedPathId, setExpandedPathId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<FilterMode>("all");
  const [pathSortBy, setPathSortBy] = useState("default");
  const [pathListFilter, setPathListFilter] = useState("all");
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const lastExpandParamHandledRef = useRef<string | null>(null);

  const pathsQuery = useQuery<PathRow[]>({
    queryKey: queryKeys.learningPaths(),
    enabled: hydrated,
    queryFn: () =>
      pathService.fetchPaths().then((r) => unwrapApiList<PathRow>(r.data)),
    staleTime: LEARNING_PATHS_STALE_MS,
  });

  const progressQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () => fetchProgressSummary().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
    enabled: hydrated && Boolean(accessToken),
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data as UserProfile),
    staleTime: staleTimes.profile,
    enabled: hydrated && Boolean(accessToken),
  });

  const entitlementsQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data as Entitlements),
    staleTime: staleTimes.entitlements,
    enabled: hydrated && Boolean(accessToken),
  });

  const questionnaireQuery = useQuery({
    queryKey: queryKeys.questionnaireProgress(),
    queryFn: fetchQuestionnaireProgress,
    staleTime: staleTimes.questionnaireProgress,
    enabled: hydrated && Boolean(accessToken),
  });

  const profilePayload = profileQuery.data;
  const profile = useMemo(() => {
    if (!profilePayload) return null;
    const ud = profilePayload.user_data as Record<string, unknown> | undefined;
    if (ud && typeof ud === "object") {
      return { ...profilePayload, ...ud } as UserProfile &
        Record<string, unknown>;
    }
    return profilePayload;
  }, [profilePayload]);

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

  const isQuestionnaireCompleted = Boolean(
    profile?.is_questionnaire_completed ??
    (profile?.user_data as { is_questionnaire_completed?: boolean } | undefined)
      ?.is_questionnaire_completed ??
    (profilePayload as UserProfile | undefined)?.is_questionnaire_completed,
  );

  const questionnaireProgress = questionnaireQuery.data;
  const questionnaireCompletedForUi =
    isQuestionnaireCompleted || questionnaireProgress?.status === "completed";

  // Who may see the personalized-path view: paid users get the full path; free
  // users who finished onboarding get the preview (first tile free, rest locked
  // by the backend). Only the not-onboarded see the locked/onboarding card.
  const canEnterPersonalized = hasPlusAccess || questionnaireCompletedForUi;

  const handlePersonalizedPathClick = useCallback(() => {
    if (!accessToken) {
      router.push(href("/login"));
      return;
    }
    if (hasPlusAccess) {
      setActiveView("personalized-path");
      return;
    }
    if (!questionnaireCompletedForUi) {
      router.push(href("/onboarding?reason=personalized_path"));
      return;
    }
    // Free + onboarded: open the preview (first tile playable, rest locked →
    // tapping a locked tile opens the paywall). No redirect away from here.
    setActiveView("personalized-path");
  }, [accessToken, hasPlusAccess, questionnaireCompletedForUi]);

  useEffect(() => {
    if (activeView !== "personalized-path") return;
    if (!hydrated) return;
    if (!accessToken) {
      router.replace(href("/login"));
      return;
    }
    if (
      profileQuery.isPending ||
      entitlementsQuery.isPending ||
      questionnaireQuery.isPending
    ) {
      return;
    }
    if (hasPlusAccess) return;
    if (!questionnaireCompletedForUi) {
      router.replace(href("/onboarding?reason=personalized_path"));
      return;
    }
    // Free + onboarded: stay on the view to show the preview (the journey map
    // renders the unlocked first tile + locked/fogged tiles + upgrade prompt).
  }, [
    activeView,
    hydrated,
    accessToken,
    hasPlusAccess,
    questionnaireCompletedForUi,
    profileQuery.isPending,
    entitlementsQuery.isPending,
    questionnaireQuery.isPending,
  ]);

  const expandedPath = useMemo(
    () =>
      (pathsQuery.data ?? []).find(
        (p) => p.id != null && Number(p.id) === Number(expandedPathId),
      ),
    [pathsQuery.data, expandedPathId],
  );
  const expandedLocked = expandedPath?.is_locked === true;

  const coursesQuery = useQuery<CourseRow[]>({
    queryKey: ["courses", expandedPathId],
    enabled: hydrated && expandedPathId != null && !expandedLocked,
    queryFn: () =>
      courseService
        .fetchForPath(expandedPathId!)
        .then((r) => unwrapApiList<CourseRow>(r.data)),
    staleTime: LEARNING_PATHS_STALE_MS,
  });

  const togglePath = useCallback((id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    setExpandedPathId((prev) => (prev === n ? null : n));
  }, []);

  useEffect(() => {
    if (expandPath == null || expandPath === "") return;
    if (lastExpandParamHandledRef.current === String(expandPath)) return;
    lastExpandParamHandledRef.current = String(expandPath);
    const n = Number(expandPath);
    if (!Number.isFinite(n)) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPathId(n);
    setTimeout(() => {
      router.replace("/(tabs)/learn");
    }, 0);
  }, [expandPath]);

  const filteredPaths = useMemo(() => {
    const paths = pathsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return paths;
    return paths.filter((p) => {
      const hay =
        `${p.title ?? p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pathsQuery.data, query]);

  const displayPaths = useMemo(
    () => applyPathSortAndFilter(filteredPaths, pathSortBy, pathListFilter),
    [filteredPaths, pathSortBy, pathListFilter],
  );

  const filterCourses = useCallback(
    (courses: CourseRow[]) => {
      return courses.filter((course) => {
        const total = courseTotalLessons(course);
        const done = course.completed_lessons ?? 0;
        const pct = total > 0 ? done / total : 0;
        if (courseFilter === "completed") return pct >= 1;
        if (courseFilter === "in_progress") return pct > 0 && pct < 1;
        return true;
      });
    },
    [courseFilter],
  );

  /**
   * Prefer /courses/?path= when it returns rows. If the API returns [] (plan filter, etc.) but
   * GET /paths/ already included nested courses, use those so Learn matches the web app.
   */
  const mergedCourseRowsRaw = useMemo((): CourseRow[] => {
    const nested = (expandedPath?.courses ?? []) as CourseRow[];
    const fromQuery = coursesQuery.data;

    if (coursesQuery.isError) {
      return nested.length > 0 ? nested : [];
    }
    if (coursesQuery.isSuccess) {
      const q = fromQuery ?? [];
      if (q.length > 0) return q;
      return nested.length > 0 ? nested : [];
    }
    return nested.length > 0 ? nested : [];
  }, [
    coursesQuery.data,
    coursesQuery.isSuccess,
    coursesQuery.isError,
    expandedPath?.courses,
  ]);

  const expandedCourses = useMemo(
    () => filterCourses(mergedCourseRowsRaw),
    [filterCourses, mergedCourseRowsRaw],
  );

  const filterHidesAllCourses =
    mergedCourseRowsRaw.length > 0 &&
    expandedCourses.length === 0 &&
    courseFilter !== "all";

  const pathSortMenuOptions = useMemo(
    () =>
      (
        [
          ["default", t("allTopics.sort.default")],
          ["name", t("allTopics.sort.name")],
          ["easiest", t("allTopics.sort.easiest")],
          ["hardest", t("allTopics.sort.hardest")],
          ["progress-asc", t("allTopics.sort.progressAsc")],
          ["progress-desc", t("allTopics.sort.progressDesc")],
        ] as const
      ).map(([value, label]) => ({ value, label })),
    [t],
  );

  const pathListMenuOptions = useMemo(
    () =>
      (
        [
          ["all", t("allTopics.filter.all")],
          ["not-started", t("allTopics.filter.notStarted")],
          ["in-progress", t("allTopics.filter.inProgress")],
          ["completed", t("allTopics.filter.completed")],
        ] as const
      ).map(([value, label]) => ({ value, label })),
    [t],
  );

  const courseFilterMenuOptions = useMemo(
    () => [
      { value: "all" as const, label: t("allTopics.coursesFilter.all") },
      {
        value: "in_progress" as const,
        label: t("allTopics.coursesFilter.inProgress"),
      },
      {
        value: "completed" as const,
        label: t("allTopics.coursesFilter.completed"),
      },
    ],
    [t],
  );

  const onRefreshPersonalized = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        profileQuery.refetch(),
        questionnaireQuery.refetch(),
        progressQuery.refetch(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.personalizedPath(),
        }),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [profileQuery, questionnaireQuery, progressQuery, queryClient]);

  const onRefreshAllTopics = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([pathsQuery.refetch(), progressQuery.refetch()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [pathsQuery, progressQuery]);

  // Tapping the active tab scrolls this screen back to the top — the standard
  // affordance after a long scroll. Driven by React Navigation off this ref.
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);

  const segmentRow = useMemo(
    () => (
      <View style={styles.segmentRow}>
        <View style={styles.segmentItem}>
          <GlassButton
            variant={activeView === "all-topics" ? "active" : "ghost"}
            size="sm"
            onPress={() => setActiveView("all-topics")}
            style={styles.segmentBtn}
          >
            {t("dashboard.nav.allTopics")}
          </GlassButton>
        </View>
        <View style={styles.segmentItem}>
          <GlassButton
            variant={activeView === "personalized-path" ? "active" : "ghost"}
            size="sm"
            onPress={handlePersonalizedPathClick}
            disabled={
              Boolean(accessToken) &&
              (profileQuery.isPending || profileQuery.isFetching)
            }
            style={styles.segmentBtn}
          >
            {t("dashboard.nav.personalizedPath")}
          </GlassButton>
          {accessToken && !questionnaireCompletedForUi ? (
            <View
              style={[
                styles.onboardingBadge,
                { backgroundColor: `${c.error}22` },
              ]}
            >
              <Text
                style={[styles.onboardingBadgeText, { color: c.error }]}
                numberOfLines={1}
              >
                {t("dashboard.nav.completeOnboarding")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    ),
    [
      accessToken,
      activeView,
      c.error,
      handlePersonalizedPathClick,
      profileQuery.isFetching,
      profileQuery.isPending,
      questionnaireCompletedForUi,
      styles.onboardingBadge,
      styles.onboardingBadgeText,
      styles.segmentBtn,
      styles.segmentItem,
      styles.segmentRow,
      t,
    ],
  );

  const isMainLoading =
    !hydrated ||
    (activeView === "all-topics" && pathsQuery.isPending) ||
    (activeView === "personalized-path" &&
      (profileQuery.isPending ||
        entitlementsQuery.isPending ||
        questionnaireQuery.isPending));

  useEffect(() => {
    if (!isMainLoading) {
      setLoadTimedOut(false);
      return;
    }
    const t = setTimeout(() => setLoadTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [isMainLoading]);

  if (loadTimedOut) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ErrorState
          message={t("common.loadTimeout")}
          onRetry={() => {
            setLoadTimedOut(false);
            void pathsQuery.refetch();
            void profileQuery.refetch();
            void progressQuery.refetch();
          }}
        />
      </View>
    );
  }

  if (!hydrated) {
    return (
      <View style={styles.loadingWrap}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton
            key={i}
            width="100%"
            height={90}
            style={{ marginBottom: spacing.md }}
          />
        ))}
      </View>
    );
  }

  if (activeView === "all-topics" && pathsQuery.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View
          style={[
            styles.headerPad,
            { paddingHorizontal: screenPad, paddingBottom: spacing.sm },
          ]}
        >
          {segmentRow}
        </View>
        <View style={styles.loadingWrap}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton
              key={i}
              width="100%"
              height={90}
              style={{ marginBottom: spacing.md }}
            />
          ))}
        </View>
      </View>
    );
  }

  if (activeView === "all-topics" && pathsQuery.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View
          style={[
            styles.headerPad,
            { paddingHorizontal: screenPad, paddingBottom: spacing.sm },
          ]}
        >
          {segmentRow}
        </View>
        <ErrorState
          message={t("allTopics.error")}
          onRetry={() => void pathsQuery.refetch()}
        />
      </View>
    );
  }

  if (activeView === "personalized-path") {
    const personalizedGatingWait =
      Boolean(accessToken) &&
      (profileQuery.isPending ||
        entitlementsQuery.isPending ||
        questionnaireQuery.isPending);

    // Full-bleed journey: the map's own header carries the view switchers,
    // so the segment + mode rows are hidden to give the climb the screen.
    const journeyFullBleed =
      canEnterPersonalized &&
      !personalizedGatingWait &&
      personalizedMode === "journey";

    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {journeyFullBleed ? null : (
          <View
            style={[
              styles.headerPad,
              { paddingHorizontal: screenPad, paddingBottom: spacing.sm },
            ]}
          >
            {segmentRow}
          </View>
        )}
        {personalizedGatingWait ? (
          <View style={styles.personalizedLoading}>
            {/* Hero card */}
            <Skeleton
              width="100%"
              height={200}
              borderRadius={radius.lg}
              style={{ marginBottom: spacing.md }}
            />
            {/* Recommendation cards */}
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                width="100%"
                height={110}
                borderRadius={radius.lg}
                style={{ marginBottom: spacing.sm }}
              />
            ))}
          </View>
        ) : canEnterPersonalized ? (
          <View style={{ flex: 1 }}>
            {personalizedMode === "journey" ? (
              <JourneyMapContent
                onCourseClick={(courseId) => {
                  router.push(`/flow/${courseId}`);
                }}
                onSwitchToList={() => setPersonalizedMode("list")}
                onShowAllTopics={() => setActiveView("all-topics")}
              />
            ) : (
              <>
                <View style={styles.modeRow}>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onPress={() => setPersonalizedMode("journey")}
                  >
                    {t("journey.modeJourney", { defaultValue: "Journey" })}
                  </GlassButton>
                  <GlassButton
                    variant="active"
                    size="sm"
                    onPress={() => setPersonalizedMode("list")}
                  >
                    {t("journey.modeList", { defaultValue: "List" })}
                  </GlassButton>
                </View>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{
                    paddingHorizontal: screenPad,
                    paddingBottom: spacing.xxxl,
                  }}
                  refreshControl={
                    <RefreshControl
                      refreshing={pullRefreshing}
                      onRefresh={() => void onRefreshPersonalized()}
                      tintColor={c.primary}
                    />
                  }
                >
                  <PersonalizedPathContentMobile
                    onCourseClick={(courseId) => {
                      router.push(`/flow/${courseId}`);
                    }}
                  />
                </ScrollView>
              </>
            )}
          </View>
        ) : (
          <View style={styles.personalizedLoading}>
            <GlassCard
              padding="lg"
              style={{
                borderRadius: radius.lg,
                borderColor: c.border,
                backgroundColor: c.surface,
              }}
            >
              <Text style={[styles.pathTitle, { color: c.text }]}>
                {t("learn.personalizedPathLocked")}
              </Text>
              <Text
                style={[
                  styles.pathDesc,
                  { color: c.textMuted, marginTop: spacing.xs },
                ]}
              >
                {questionnaireCompletedForUi
                  ? t("learn.upgradeToUnlockPersonalizedPath")
                  : t("learn.completeOnboardingToUnlock")}
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <GlassButton
                  onPress={() =>
                    router.push(
                      questionnaireCompletedForUi
                        ? href("/subscriptions?reason=personalized_path")
                        : href("/onboarding?reason=personalized_path"),
                    )
                  }
                >
                  {questionnaireCompletedForUi
                    ? t("learn.viewPlansButton")
                    : t("learn.continueOnboarding")}
                </GlassButton>
              </View>
            </GlassCard>
          </View>
        )}
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      style={{ flex: 1, backgroundColor: c.bg }}
      data={displayPaths}
      keyExtractor={(item, i) => String(item.id ?? i)}
      nestedScrollEnabled={Platform.OS === "android"}
      contentContainerStyle={listContentStyle}
      refreshControl={
        <RefreshControl
          refreshing={pullRefreshing}
          onRefresh={() => void onRefreshAllTopics()}
          tintColor={c.primary}
        />
      }
      ListEmptyComponent={
        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
          <Text style={[styles.pathDesc, { textAlign: "center" }]}>
            {(pathsQuery.data?.length ?? 0) > 0
              ? t("allTopics.emptyNoMatch")
              : t("allTopics.emptyNoApi")}
          </Text>
        </View>
      }
      ListHeaderComponent={
        <View style={[styles.headerPad, styles.headerBlock]}>
          {segmentRow}
          <ContinueLearningCard resume={progressQuery.data?.resume} />
          <Text style={styles.heading}>{t("allTopics.heading")}</Text>
          <TextInput
            style={styles.search}
            placeholder={t("allTopics.searchPlaceholder")}
            placeholderTextColor={c.textFaint}
            value={query}
            onChangeText={setQuery}
          />
          <View style={styles.filterRow}>
            <SelectMenu
              style={styles.filterHalf}
              label={t("allTopics.sortByLabel")}
              value={pathSortBy}
              options={pathSortMenuOptions}
              onChange={setPathSortBy}
            />
            <SelectMenu
              style={styles.filterHalf}
              label={t("allTopics.filterLabel")}
              value={pathListFilter}
              options={pathListMenuOptions}
              onChange={setPathListFilter}
            />
          </View>
          <SelectMenu
            label={t("allTopics.coursesFilterLabel")}
            value={courseFilter}
            options={courseFilterMenuOptions}
            onChange={(v) => setCourseFilter(v as FilterMode)}
          />
        </View>
      }
      renderItem={({ item }) => {
        const isExpanded =
          item.id != null && Number(item.id) === Number(expandedPathId);
        const title = item.title ?? item.name ?? `Path ${item.id}`;
        const desc = item.description ?? "";
        const pct = pathProgressPercent(item);
        return (
          <GlassCard padding="none" style={{ marginBottom: spacing.lg }}>
            <Pressable
              onPress={() => {
                if (item.is_locked) {
                  router.push("/subscriptions");
                  return;
                }
                item.id != null && togglePath(Number(item.id));
              }}
            >
              <PathSceneHeader
                title={title}
                pathId={item.id != null ? Number(item.id) : undefined}
                progressPct={pct}
              />
              <View style={{ padding: spacing.md }}>
                <Text
                  style={[styles.pathTitle, { color: c.text }]}
                  numberOfLines={2}
                >
                  {title}
                </Text>
                {desc ? (
                  <Text
                    style={[styles.pathDesc, { color: c.textMuted }]}
                    numberOfLines={2}
                  >
                    {desc}
                  </Text>
                ) : null}
                <Text style={[styles.progressMeta, { color: c.primary }]}>
                  {t("allTopics.pathProgress")}: {pct}%
                </Text>
                {item.is_locked ? (
                  <Text
                    style={[
                      styles.pathDesc,
                      { color: c.accent, marginTop: 6, fontWeight: "700" },
                    ]}
                  >
                    {t("allTopics.upgradeTo", { plan: "Plus" })}
                  </Text>
                ) : (
                  <Text style={styles.expandHint}>
                    {isExpanded
                      ? t("allTopics.hideCourses")
                      : t("allTopics.viewCourses")}
                  </Text>
                )}
              </View>
            </Pressable>

            {isExpanded && !item.is_locked ? (
              <View
                style={[
                  styles.coursesList,
                  { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
                ]}
              >
                {coursesQuery.isPending && expandedCourses.length === 0 ? (
                  <Skeleton width="100%" height={70} />
                ) : coursesQuery.isError && expandedCourses.length === 0 ? (
                  <Text style={styles.error}>Failed to load courses.</Text>
                ) : filterHidesAllCourses ? (
                  <Text
                    style={[
                      styles.pathDesc,
                      { color: c.textMuted, marginTop: spacing.sm },
                    ]}
                  >
                    No courses match this filter. Tap{" "}
                    <Text style={{ fontWeight: "700" }}>All</Text> above to see
                    every course in this path.
                  </Text>
                ) : expandedCourses.length === 0 ? (
                  <Text
                    style={[
                      styles.pathDesc,
                      { color: c.textMuted, marginTop: spacing.sm },
                    ]}
                  >
                    No courses for this path yet.
                  </Text>
                ) : (
                  expandedCourses.map((course, ci) => (
                    <View
                      key={course.id ?? ci}
                      style={{ marginBottom: spacing.sm }}
                    >
                      <CourseCard
                        course={course}
                        totalLessons={courseTotalLessons(course)}
                        onPress={() =>
                          course.id != null && router.push(`/flow/${course.id}`)
                        }
                      />
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </GlassCard>
        );
      }}
    />
  );
}

function LearnScreenHeader() {
  const { t } = useTranslation("common");
  return (
    <TabScreenHeader
      title={t("nav.learn")}
      left={<HeaderAvatarButton />}
      right={<HeaderRightButtons />}
    />
  );
}

export default function LearnScreen() {
  return (
    <TabErrorBoundary>
      <View style={{ flex: 1 }}>
        <LearnScreenHeader />
        <LearnInner />
      </View>
    </TabErrorBoundary>
  );
}
