import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { pathService, courseService, queryKeys, staleTimes } from "@monevo/core";
import {
  Badge,
  Card,
  ErrorState,
  ProgressBar,
  SelectMenu,
  Skeleton,
} from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { useAuthSession } from "../../src/auth/AuthContext";
import { unwrapApiList } from "../../src/lib/unwrapApiList";
import { applyPathSortAndFilter } from "../../src/lib/pathProgress";
import { useThemeColors } from "../../src/theme/ThemeContext";
import type { ThemeColors } from "../../src/theme/palettes";
import { spacing, typography, radius, shadows } from "../../src/theme/tokens";

type CourseRow = {
  id?: number;
  title?: string;
  name?: string;
  short_description?: string;
  completed_lessons?: number;
  total_lessons?: number;
  lesson_count?: number;
};

type PathRow = {
  id?: number;
  title?: string;
  name?: string;
  description?: string;
  /** From API: path requires a higher plan than the user has */
  is_locked?: boolean;
  /** Included on GET /paths/ — use when /courses/?path= is slow or fails */
  courses?: CourseRow[];
};

function courseTotalLessons(c: CourseRow): number {
  return c.total_lessons ?? c.lesson_count ?? 0;
}

type FilterMode = "all" | "in_progress" | "completed";

function createLearnStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
      backgroundColor: c.bg,
    },
    loadingWrap: { flex: 1, padding: spacing.xl, backgroundColor: c.bg },
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
    coursesList: {
      marginTop: spacing.sm,
      paddingLeft: spacing.md,
      gap: spacing.sm,
    },
    courseRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      ...shadows.sm,
    },
    courseInfo: { flex: 1, marginRight: spacing.md },
    courseTitle: {
      fontSize: typography.base,
      fontWeight: "600",
      color: c.text,
    },
    courseMeta: {
      fontSize: typography.xs,
      color: c.textMuted,
      marginTop: 2,
    },
    error: { color: c.error, fontSize: typography.sm },
  });
}

function LearnInner() {
  const c = useThemeColors();
  const styles = useMemo(() => createLearnStyles(c), [c]);
  const { hydrated } = useAuthSession();
  const { t } = useTranslation("common");

  const [expandedPathId, setExpandedPathId] = useState<number | null>(null);
  const { expandPath } = useLocalSearchParams<{ expandPath?: string }>();
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<FilterMode>("all");
  const [pathSortBy, setPathSortBy] = useState("default");
  const [pathListFilter, setPathListFilter] = useState("all");

  const pathsQuery = useQuery<PathRow[]>({
    queryKey: queryKeys.learningPaths(),
    enabled: hydrated,
    queryFn: () => pathService.fetchPaths().then((r) => unwrapApiList<PathRow>(r.data)),
    staleTime: staleTimes.content,
  });

  const expandedPath = useMemo(
    () =>
      (pathsQuery.data ?? []).find(
        (p) => p.id != null && Number(p.id) === Number(expandedPathId)
      ),
    [pathsQuery.data, expandedPathId]
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
    const n = Number(expandPath);
    if (!Number.isFinite(n)) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPathId(n);
    router.replace("/(tabs)/learn");
  }, [expandPath]);

  const filteredPaths = useMemo(() => {
    const paths = pathsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return paths;
    return paths.filter((p) => {
      const hay = `${p.title ?? p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pathsQuery.data, query]);

  const displayPaths = useMemo(
    () => applyPathSortAndFilter(filteredPaths, pathSortBy, pathListFilter),
    [filteredPaths, pathSortBy, pathListFilter]
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
    [courseFilter]
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
    [filterCourses, mergedCourseRowsRaw]
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
    [t]
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
    [t]
  );

  const courseFilterMenuOptions = useMemo(
    () => [
      { value: "all" as const, label: t("allTopics.coursesFilter.all") },
      { value: "in_progress" as const, label: t("allTopics.coursesFilter.inProgress") },
      { value: "completed" as const, label: t("allTopics.coursesFilter.completed") },
    ],
    [t]
  );

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

  if (pathsQuery.isPending) {
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

  if (pathsQuery.isError) {
    return (
      <ErrorState
        message="Could not load learning paths."
        onRetry={() => void pathsQuery.refetch()}
      />
    );
  }

  return (
    <FlatList
      style={{ flex: 1 }}
      data={displayPaths}
      keyExtractor={(item, i) => String(item.id ?? i)}
      nestedScrollEnabled
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={pathsQuery.isFetching}
          onRefresh={() => void pathsQuery.refetch()}
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
        <View style={styles.headerBlock}>
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
        return (
          <View style={{ marginBottom: spacing.md }}>
            <Pressable
              onPress={() => item.id != null && togglePath(Number(item.id))}
            >
              <Card>
                <Text style={styles.pathTitle}>{title}</Text>
                {desc ? (
                  <Text style={styles.pathDesc} numberOfLines={2}>
                    {desc}
                  </Text>
                ) : null}
                <Text style={styles.expandHint}>
                  {isExpanded ? t("allTopics.hideCourses") : t("allTopics.viewCourses")}
                </Text>
              </Card>
            </Pressable>

            {isExpanded ? (
              <View style={styles.coursesList}>
                {expandedLocked ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={styles.pathDesc}>
                      {t("learn.lockedPathNeedsPlan")}
                    </Text>
                    <Pressable onPress={() => router.push("/subscriptions")}>
                      <Text style={[styles.expandHint, { marginTop: spacing.sm }]}>
                        {t("learn.viewPlans")}
                      </Text>
                    </Pressable>
                  </View>
                ) : coursesQuery.isPending && expandedCourses.length === 0 ? (
                  <Skeleton width="100%" height={70} />
                ) : coursesQuery.isError && expandedCourses.length === 0 ? (
                  <Text style={styles.error}>Failed to load courses.</Text>
                ) : filterHidesAllCourses ? (
                  <Text style={[styles.pathDesc, { marginTop: spacing.sm }]}>
                    No courses match this filter. Tap <Text style={{ fontWeight: "700" }}>All</Text>{" "}
                    above to see every course in this path.
                  </Text>
                ) : expandedCourses.length === 0 ? (
                  <Text style={[styles.pathDesc, { marginTop: spacing.sm }]}>
                    No courses for this path. If you use Docker locally, ensure the API has content
                    (migrations + seed commands in backend logs). Use a Starter-tier path (e.g. Basic
                    Finance) or upgrade under Billing. API: EXPO_PUBLIC_BACKEND_URL must reach your
                    Django host.
                  </Text>
                ) : (
                  expandedCourses.map((course, ci) => {
                    const done = course.completed_lessons ?? 0;
                    const total = courseTotalLessons(course);
                    const pct = total > 0 ? done / total : 0;
                    const status =
                      pct >= 1 ? "Completed" : pct > 0 ? "In progress" : "Start";
                    const statusColor =
                      pct >= 1 ? c.success : pct > 0 ? c.accent : c.primary;

                    return (
                      <Pressable
                        key={course.id ?? ci}
                        style={styles.courseRow}
                        onPress={() =>
                          course.id != null && router.push(`/flow/${course.id}`)
                        }
                      >
                        <View style={styles.courseInfo}>
                          <Text style={styles.courseTitle}>
                            {course.title ?? course.name ?? `Course ${course.id}`}
                          </Text>
                          {total > 0 ? (
                            <Text style={styles.courseMeta}>
                              {done}/{total} lessons
                            </Text>
                          ) : null}
                          {total > 0 ? (
                            <ProgressBar
                              value={pct}
                              color={statusColor}
                              height={4}
                              style={{ marginTop: spacing.xs }}
                            />
                          ) : null}
                        </View>
                        <Badge label={status} color={statusColor} />
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

export default function LearnScreen() {
  return (
    <TabErrorBoundary>
      <LearnInner />
    </TabErrorBoundary>
  );
}
