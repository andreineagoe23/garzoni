import { useMemo, useState, useCallback } from "react";
import {
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLearningPathCourses,
  fetchLearningPaths,
  getMediaBaseUrl,
  Images,
  queryKeys,
  staleTimes,
} from "@monevo/core";
import { useTranslation } from "react-i18next";
import { useAuthSession } from "../../auth/AuthContext";
import { unwrapApiList } from "../../lib/unwrapApiList";
import {
  applyPathSortAndFilter,
  getCourseLessonCount,
  pathProgressPercent,
} from "../../lib/pathProgress";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import SelectMenu from "../ui/SelectMenu";
import { spacing, typography, radius } from "../../theme/tokens";

type PathRow = {
  id: number;
  title: string;
  description?: string;
  image?: string;
  courses?: {
    id: number;
    title?: string;
    completed_lessons?: number;
    total_lessons?: number;
    lesson_count?: number;
    lessons?: unknown[];
  }[];
  is_locked?: boolean;
};

type CourseInPath = NonNullable<PathRow["courses"]>[number];

function coverForPath(p: PathRow): string {
  if (p.image) {
    return p.image.startsWith("http")
      ? p.image
      : `${getMediaBaseUrl()}/media/${String(p.image).replace(/^\/+/, "")}`;
  }
  const t = (p.title ?? "").toLowerCase();
  if (t.includes("crypto")) return Images.crypto;
  if (t.includes("forex") || t.includes("fx")) return Images.forex;
  if (t.includes("mindset")) return Images.mindset;
  if (t.includes("real estate") || t.includes("property")) return Images.realEstate;
  if (t.includes("personal")) return Images.personalFinance;
  return Images.basicFinance;
}

export default function AllTopicsGrid() {
  const c = useThemeColors();
  const { hydrated } = useAuthSession();
  const { t } = useTranslation("common");
  const { t: tc } = useTranslation("courses");

  const [sortBy, setSortBy] = useState("default");
  const [pathFilter, setPathFilter] = useState("all");
  const [expandedPathId, setExpandedPathId] = useState<number | null>(null);

  const q = useQuery({
    queryKey: queryKeys.learningPaths(),
    enabled: hydrated,
    queryFn: () => fetchLearningPaths().then((r) => unwrapApiList<PathRow>(r.data)),
    staleTime: staleTimes.content,
  });

  const paths = useMemo(() => q.data ?? [], [q.data]);

  const orderedPaths = useMemo(
    () => applyPathSortAndFilter(paths, sortBy, pathFilter),
    [paths, sortBy, pathFilter]
  );

  const expandedPathRow = useMemo(
    () => orderedPaths.find((x) => Number(x.id) === Number(expandedPathId)),
    [orderedPaths, expandedPathId]
  );

  const expandedLocked = expandedPathRow?.is_locked === true;

  const pathCoursesQuery = useQuery({
    queryKey: queryKeys.learningPathCourses(expandedPathId ?? 0),
    enabled: hydrated && expandedPathId != null && !expandedLocked,
    queryFn: () =>
      fetchLearningPathCourses(expandedPathId!).then((r) =>
        unwrapApiList<CourseInPath>(r.data)
      ),
    staleTime: staleTimes.content,
  });

  const expandedCoursesMerged = useMemo((): CourseInPath[] => {
    const nested = (expandedPathRow?.courses ?? []) as CourseInPath[];
    const fromQuery = pathCoursesQuery.data;
    if (pathCoursesQuery.isError) {
      return nested.length > 0 ? nested : [];
    }
    if (pathCoursesQuery.isSuccess) {
      const rows = fromQuery ?? [];
      if (rows.length > 0) return rows;
      return nested.length > 0 ? nested : [];
    }
    return nested.length > 0 ? nested : [];
  }, [
    pathCoursesQuery.data,
    pathCoursesQuery.isSuccess,
    pathCoursesQuery.isError,
    expandedPathRow?.courses,
  ]);

  const togglePath = useCallback((pathId: number, locked: boolean) => {
    if (locked) {
      router.push("/subscriptions");
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPathId((prev) => (prev === pathId ? null : pathId));
  }, []);

  const sortOptions = useMemo(
    () =>
      [
        ["default", t("allTopics.sort.default")],
        ["name", t("allTopics.sort.name")],
        ["easiest", t("allTopics.sort.easiest")],
        ["hardest", t("allTopics.sort.hardest")],
        ["progress-asc", t("allTopics.sort.progressAsc")],
        ["progress-desc", t("allTopics.sort.progressDesc")],
      ] as const,
    [t]
  );

  const filterOptions = useMemo(
    () =>
      [
        ["all", t("allTopics.filter.all")],
        ["not-started", t("allTopics.filter.notStarted")],
        ["in-progress", t("allTopics.filter.inProgress")],
        ["completed", t("allTopics.filter.completed")],
      ] as const,
    [t]
  );

  const sortMenuOptions = useMemo(
    () => sortOptions.map(([v, lbl]) => ({ value: v, label: lbl })),
    [sortOptions]
  );
  const filterMenuOptions = useMemo(
    () => filterOptions.map(([v, lbl]) => ({ value: v, label: lbl })),
    [filterOptions]
  );

  if (!hydrated || q.isPending) {
    return (
      <View>
        <Text style={[styles.heading, { color: c.accent }]}>
          {t("dashboard.nav.allTopics")}
        </Text>
        <Text style={{ color: c.textMuted }}>{t("allTopics.loading")}</Text>
      </View>
    );
  }

  if (q.isError) {
    return (
      <View>
        <Text style={[styles.heading, { color: c.accent }]}>
          {t("dashboard.nav.allTopics")}
        </Text>
        <Text style={{ color: c.error }}>{t("allTopics.error")}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.heading, { color: c.accent }]}>
        {t("dashboard.nav.allTopics")}
      </Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        {tc("coursePage.subtitle")}
      </Text>

      <View style={styles.filterRow}>
        <SelectMenu
          style={styles.filterHalf}
          label={t("allTopics.sortByLabel")}
          value={sortBy}
          options={sortMenuOptions}
          onChange={setSortBy}
        />
        <SelectMenu
          style={styles.filterHalf}
          label={t("allTopics.filterLabel")}
          value={pathFilter}
          options={filterMenuOptions}
          onChange={setPathFilter}
        />
      </View>

      {orderedPaths.length === 0 ? (
        <GlassCard padding="lg" style={{ marginTop: spacing.md }}>
          <Text style={[styles.cardDesc, { color: c.textMuted }]}>
            {tc("learningPath.noPathsAvailable")}
          </Text>
        </GlassCard>
      ) : (
        <ScrollView
          style={{ marginTop: spacing.md }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {orderedPaths.map((p) => {
            const uri = coverForPath(p);
            const pct = pathProgressPercent(p);
            const isExpanded = Number(expandedPathId) === Number(p.id);
            const courses = isExpanded ? expandedCoursesMerged : [];
            return (
              <GlassCard key={p.id} padding="none" style={[styles.pathCard, { marginBottom: spacing.lg }]}>
                <Pressable onPress={() => togglePath(p.id, p.is_locked === true)}>
                  <Image source={{ uri }} style={styles.pathCover} />
                  <View style={{ padding: spacing.md }}>
                    <Text style={[styles.pathTitle, { color: c.text }]} numberOfLines={2}>
                      {p.title}
                    </Text>
                    {p.description ? (
                      <Text
                        style={[styles.cardDesc, { color: c.textMuted }]}
                        numberOfLines={2}
                      >
                        {p.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.progressMeta, { color: c.primary }]}>
                      {t("allTopics.pathProgress")}: {pct}%
                    </Text>
                    {p.is_locked ? (
                      <Text
                        style={[styles.cardDesc, { color: c.accent, marginTop: 6, fontWeight: "700" }]}
                      >
                        {t("allTopics.upgradeTo", { plan: "Plus" })}
                      </Text>
                    ) : (
                      <Text style={[styles.expandHint, { color: c.primary }]}>
                        {isExpanded ? t("allTopics.hideCourses") : t("allTopics.viewCourses")}
                      </Text>
                    )}
                  </View>
                </Pressable>

                {!p.is_locked && isExpanded && pathCoursesQuery.isPending && courses.length === 0 ? (
                  <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                    <Text style={[styles.cardDesc, { color: c.textMuted }]}>
                      {t("allTopics.loading")}
                    </Text>
                  </View>
                ) : null}

                {!p.is_locked && isExpanded && courses.length > 0 ? (
                  <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
                    {courses.map((course) => {
                      const nLessons = getCourseLessonCount(course);
                      return (
                        <Pressable
                          key={course.id}
                          onPress={() => router.push(`/flow/${course.id}`)}
                          style={[
                            styles.courseRow,
                            { borderColor: c.border, backgroundColor: c.surface },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.courseTitle, { color: c.text }]} numberOfLines={2}>
                              {course.title ?? `Course ${course.id}`}
                            </Text>
                            <Text style={[styles.lessonMeta, { color: c.textMuted }]}>
                              {tc("learningPath.lesson", { count: nLessons })}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {!p.is_locked && isExpanded && !pathCoursesQuery.isPending && courses.length === 0 ? (
                  <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                    <Text style={[styles.cardDesc, { color: c.textMuted }]}>
                      {tc("learningPath.noCoursesInPath")}
                    </Text>
                  </View>
                ) : null}
              </GlassCard>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: typography.md, fontWeight: "800" },
  sub: { fontSize: typography.sm, marginTop: 4, marginBottom: spacing.sm },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  filterHalf: { flex: 1, minWidth: 0 },
  pathCard: { overflow: "hidden" },
  pathCover: {
    width: "100%",
    height: 96,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  pathTitle: { fontSize: typography.lg, fontWeight: "700" },
  cardDesc: { fontSize: typography.xs, marginTop: 4, lineHeight: 16 },
  progressMeta: { fontSize: typography.xs, fontWeight: "600", marginTop: spacing.sm },
  expandHint: { fontSize: typography.xs, fontWeight: "700", marginTop: spacing.sm },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  courseTitle: { fontSize: typography.sm, fontWeight: "600" },
  lessonMeta: { fontSize: typography.xs, marginTop: 2 },
});
