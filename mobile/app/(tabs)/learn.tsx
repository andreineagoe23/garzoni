import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Image,
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
  getMediaBaseUrl,
  Images,
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
import ContinueLearningCard from "../../src/components/learn/ContinueLearningCard";
import PersonalizedPathContentMobile from "../../src/components/dashboard/PersonalizedPathContentMobile";
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
import { spacing, typography, radius } from "../../src/theme/tokens";
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

function coverForPath(p: PathRow): string {
  if (p.image) {
    return p.image.startsWith("http")
      ? p.image
      : `${getMediaBaseUrl()}/media/${String(p.image).replace(/^\/+/, "")}`;
  }
  const title = (p.title ?? p.name ?? "").toLowerCase();
  if (title.includes("crypto")) return Images.crypto;
  if (title.includes("forex") || title.includes("fx")) return Images.forex;
  if (title.includes("mindset")) return Images.mindset;
  if (title.includes("real estate") || title.includes("property"))
    return Images.realEstate;
  if (title.includes("personal")) return Images.personalFinance;
  return Images.basicFinance;
}

function courseTotalLessons(c: CourseRow): number {
  return c.total_lessons ?? c.lesson_count ?? 0;
}

type FilterMode = "all" | "in_progress" | "completed";

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
    pathCover: {
      width: "100%",
      height: 96,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
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
    onboardingBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    personalizedLoading: {
      flex: 1,
      minHeight: 200,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}

function LearnInner() {
  const c = useThemeColors();
  const styles = useMemo(() => createLearnStyles(c), [c]);
  const queryClient = useQueryClient();
  const { hydrated, accessToken } = useAuthSession();
  const { t } = useTranslation("common");

  const [activeView, setActiveView] = useState<LearnActiveView>("all-topics");
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
  const lastExpandParamHandledRef = useRef<string | null>(null);

  const pathsQuery = useQuery<PathRow[]>({
    queryKey: queryKeys.learningPaths(),
    enabled: hydrated,
    queryFn: () =>
      pathService.fetchPaths().then((r) => unwrapApiList<PathRow>(r.data)),
    staleTime: staleTimes.content,
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
    staleTime: 0,
    refetchOnMount: true,
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
    router.push(href("/subscriptions?reason=personalized_path"));
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
    router.replace(href("/subscriptions?reason=personalized_path"));
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
    staleTime: staleTimes.content,
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

  const onRefreshPersonalized = useCallback(() => {
    void profileQuery.refetch();
    void questionnaireQuery.refetch();
    void progressQuery.refetch();
    void queryClient.invalidateQueries({
      queryKey: queryKeys.personalizedPath(),
    });
  }, [profileQuery, questionnaireQuery, progressQuery, queryClient]);

  const segmentRow = useMemo(
    () => (
      <View style={styles.segmentRow}>
        <GlassButton
          variant={activeView === "all-topics" ? "active" : "ghost"}
          size="sm"
          onPress={() => setActiveView("all-topics")}
        >
          {t("dashboard.nav.allTopics")}
        </GlassButton>
        <View style={styles.segmentPersonalized}>
          <GlassButton
            variant={activeView === "personalized-path" ? "active" : "ghost"}
            size="sm"
            onPress={handlePersonalizedPathClick}
            disabled={
              Boolean(accessToken) &&
              (profileQuery.isPending || profileQuery.isFetching)
            }
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
      styles.segmentPersonalized,
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
          message="Taking too long to load. Check your connection."
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
        <View style={[styles.headerPad, { paddingBottom: spacing.sm }]}>
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
        <View style={[styles.headerPad, { paddingBottom: spacing.sm }]}>
          {segmentRow}
        </View>
        <ErrorState
          message="Could not load learning paths."
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

    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={[styles.headerPad, { paddingBottom: spacing.sm }]}>
          {segmentRow}
        </View>
        {personalizedGatingWait ? (
          <View style={styles.personalizedLoading}>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                width="100%"
                height={72}
                borderRadius={radius.lg}
                style={{ marginBottom: spacing.sm }}
              />
            ))}
          </View>
        ) : hasPlusAccess ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing.md,
              paddingBottom: spacing.xxxl,
            }}
            refreshControl={
              <RefreshControl
                refreshing={
                  profileQuery.isFetching ||
                  questionnaireQuery.isFetching ||
                  progressQuery.isFetching
                }
                onRefresh={onRefreshPersonalized}
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
                Personalized path is locked
              </Text>
              <Text
                style={[
                  styles.pathDesc,
                  { color: c.textMuted, marginTop: spacing.xs },
                ]}
              >
                {questionnaireCompletedForUi
                  ? "Upgrade to Plus to unlock your personalized learning path."
                  : "Complete onboarding first to unlock your personalized path."}
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
                    ? "View plans"
                    : "Continue onboarding"}
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
      style={{ flex: 1, backgroundColor: c.bg }}
      data={displayPaths}
      keyExtractor={(item, i) => String(item.id ?? i)}
      nestedScrollEnabled={Platform.OS === "android"}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={pathsQuery.isFetching || progressQuery.isFetching}
          onRefresh={() => {
            void pathsQuery.refetch();
            void progressQuery.refetch();
          }}
          tintColor={c.primary}
        />
      }
      ListEmptyComponent={
        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
          <Text style={[styles.pathDesc, { textAlign: "center" }]}>
            {(pathsQuery.data?.length ?? 0) > 0
              ? "No paths match your search or path filter."
              : "No learning paths from the API. Check that the backend is running, EXPO_PUBLIC_BACKEND_URL points at Django, and you are signed in. Pull to refresh."}
          </Text>
        </View>
      }
      ListHeaderComponent={
        <View style={[styles.headerPad, styles.headerBlock]}>
          {segmentRow}
          <ContinueLearningCard resume={progressQuery.data?.resume} />
          <Text style={styles.heading}>Learning paths</Text>
          <TextInput
            style={styles.search}
            placeholder="Search paths…"
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
        const coverUri = coverForPath(item);
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
              <Image
                source={{ uri: coverUri }}
                style={styles.pathCover}
                resizeMode="cover"
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

export default function LearnScreen() {
  return (
    <TabErrorBoundary>
      <View style={{ flex: 1 }}>
        <TabScreenHeader
          title="Learn"
          left={<HeaderAvatarButton />}
          right={<HeaderRightButtons />}
        />
        <LearnInner />
      </View>
    </TabErrorBoundary>
  );
}
