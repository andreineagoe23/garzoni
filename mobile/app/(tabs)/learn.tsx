import { useCallback, useMemo, useState } from "react";
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
import { router } from "expo-router";
import { pathService, courseService, queryKeys, staleTimes } from "@monevo/core";
import {
  Badge,
  Card,
  ErrorState,
  ProgressBar,
  Skeleton,
} from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { colors, spacing, typography, radius, shadows } from "../../src/theme/tokens";

type PathRow = {
  id?: number;
  title?: string;
  name?: string;
  description?: string;
};

type CourseRow = {
  id?: number;
  title?: string;
  name?: string;
  short_description?: string;
  completed_lessons?: number;
  total_lessons?: number;
};

function unwrap<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw;
  const r = (raw as { results?: T[] })?.results;
  return Array.isArray(r) ? r : [];
}

type FilterMode = "all" | "in_progress" | "completed";

function LearnInner() {
  const [expandedPathId, setExpandedPathId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const pathsQuery = useQuery({
    queryKey: ["paths"],
    queryFn: () => pathService.fetchPaths().then((r) => unwrap<PathRow>(r.data)),
    staleTime: staleTimes.content,
  });

  const coursesQuery = useQuery({
    queryKey: ["courses", expandedPathId],
    enabled: expandedPathId != null,
    queryFn: () =>
      courseService
        .fetchForPath(expandedPathId!)
        .then((r) => unwrap<CourseRow>(r.data)),
    staleTime: staleTimes.content,
  });

  const togglePath = useCallback((id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedPathId((prev) => (prev === id ? null : id));
  }, []);

  const filteredPaths = useMemo(() => {
    const paths = pathsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return paths;
    return paths.filter((p) => {
      const t = `${p.title ?? p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
      return t.includes(q);
    });
  }, [pathsQuery.data, query]);

  const filterCourses = useCallback(
    (courses: CourseRow[]) => {
      return courses.filter((c) => {
        const total = c.total_lessons ?? 0;
        const done = c.completed_lessons ?? 0;
        const pct = total > 0 ? done / total : 0;
        if (filter === "completed") return pct >= 1;
        if (filter === "in_progress") return pct > 0 && pct < 1;
        return true;
      });
    },
    [filter]
  );

  if (pathsQuery.isPending) {
    return (
      <View style={styles.container}>
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
      data={filteredPaths}
      keyExtractor={(item, i) => String(item.id ?? i)}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={pathsQuery.isFetching}
          onRefresh={() => void pathsQuery.refetch()}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <Text style={styles.heading}>Learning paths</Text>
          <TextInput
            style={styles.search}
            placeholder="Search paths…"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
          />
          <View style={styles.chips}>
            {(
              [
                ["all", "All"],
                ["in_progress", "In progress"],
                ["completed", "Completed"],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.chip, filter === key && styles.chipOn]}
                onPress={() => setFilter(key)}
              >
                <Text
                  style={[styles.chipText, filter === key && styles.chipTextOn]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => {
        const isExpanded = expandedPathId === item.id;
        const title = item.title ?? item.name ?? `Path ${item.id}`;
        const desc = item.description ?? "";
        return (
          <View style={{ marginBottom: spacing.md }}>
            <Pressable onPress={() => item.id != null && togglePath(item.id)}>
              <Card>
                <Text style={styles.pathTitle}>{title}</Text>
                {desc ? (
                  <Text style={styles.pathDesc} numberOfLines={2}>
                    {desc}
                  </Text>
                ) : null}
                <Text style={styles.expandHint}>
                  {isExpanded ? "▲ Hide courses" : "▼ View courses"}
                </Text>
              </Card>
            </Pressable>

            {isExpanded ? (
              <View style={styles.coursesList}>
                {coursesQuery.isPending ? (
                  <Skeleton width="100%" height={70} />
                ) : coursesQuery.isError ? (
                  <Text style={styles.error}>Failed to load courses.</Text>
                ) : (
                  filterCourses(coursesQuery.data ?? []).map((course, ci) => {
                    const done = course.completed_lessons ?? 0;
                    const total = course.total_lessons ?? 0;
                    const pct = total > 0 ? done / total : 0;
                    const status =
                      pct >= 1 ? "Completed" : pct > 0 ? "In progress" : "Start";
                    const statusColor =
                      pct >= 1
                        ? colors.success
                        : pct > 0
                          ? colors.accent
                          : colors.primary;

                    return (
                      <Pressable
                        key={course.id ?? ci}
                        style={styles.courseRow}
                        onPress={() =>
                          course.id != null && router.push(`/course/${course.id}`)
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

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: 60, backgroundColor: colors.bg },
  headerBlock: { marginBottom: spacing.md },
  heading: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.base,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}12`,
  },
  chipText: { fontSize: typography.xs, fontWeight: "600", color: colors.textMuted },
  chipTextOn: { color: colors.primary },
  pathTitle: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
  },
  pathDesc: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  expandHint: {
    fontSize: typography.xs,
    color: colors.primary,
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.sm,
  },
  courseInfo: { flex: 1, marginRight: spacing.md },
  courseTitle: {
    fontSize: typography.base,
    fontWeight: "600",
    color: colors.text,
  },
  courseMeta: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  error: { color: colors.error, fontSize: typography.sm },
});
