import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchExerciseById,
  fetchExerciseCategories,
  fetchExercisesList,
  queryKeys,
  staleTimes,
} from "@monevo/core";
import ExerciseSection from "../../src/components/lesson/ExerciseSection";
import MascotWithMessage from "../../src/components/common/MascotWithMessage";
import { Button, ErrorState, ScreenScroll, Skeleton } from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../src/theme/tokens";
import { Pressable } from "react-native";

type ExerciseListItem = { id: number; type?: string; category?: string };

function ExercisesInner() {
  const c = useThemeColors();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [pickedId, setPickedId] = useState<number | null>(null);

  useEffect(() => {
    if (categoryParam) setCategory(categoryParam);
  }, [categoryParam]);

  const initialCategory = categoryParam ?? category;
  const categoriesQuery = useQuery({
    queryKey: queryKeys.exerciseCategories(),
    queryFn: () => fetchExerciseCategories().then((r) => r.data as string[]),
    staleTime: staleTimes.content,
  });

  const listQuery = useQuery({
    queryKey: [...queryKeys.exercises(), initialCategory ?? "all"],
    queryFn: () =>
      fetchExercisesList(
        initialCategory ? { category: initialCategory } : undefined
      ).then((r) => r.data as ExerciseListItem[]),
    staleTime: staleTimes.progressSummary,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.exerciseDetail(pickedId ?? 0),
    queryFn: () => fetchExerciseById(pickedId!).then((r) => r.data as Record<string, unknown>),
    enabled: pickedId != null,
  });

  const pickRandom = useCallback(() => {
    const list = listQuery.data ?? [];
    if (!list.length) return;
    const choice = list[Math.floor(Math.random() * list.length)];
    setPickedId(choice.id);
  }, [listQuery.data]);

  const list = listQuery.data ?? [];

  const mergedCategory = categoryParam || category;

  const filteredList = useMemo(() => {
    if (!mergedCategory) return list;
    return list.filter((x) => (x.category || "").toLowerCase() === mergedCategory.toLowerCase());
  }, [list, mergedCategory]);

  return (
    <ScreenScroll
      contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={
        <RefreshControl
          refreshing={listQuery.isFetching}
          onRefresh={() => void listQuery.refetch()}
          tintColor={c.primary}
        />
      }
    >
      <Text style={[styles.title, { color: c.text }]}>Exercises</Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        Practice with standalone drills. Pick a category or go random.
      </Text>

      <MascotWithMessage mood="encourage" rotationKey={2} />

      <Text style={[styles.section, { color: c.accent }]}>Category</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: spacing.md }}
      >
        <Pressable
          onPress={() => setCategory(undefined)}
          style={[
            styles.chip,
            { borderColor: c.border, backgroundColor: mergedCategory ? c.surface : c.accentMuted },
          ]}
        >
          <Text style={{ color: c.text, fontWeight: "600" }}>All</Text>
        </Pressable>
        {(categoriesQuery.data ?? []).map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            style={[
              styles.chip,
              {
                borderColor: c.border,
                backgroundColor:
                  mergedCategory === cat ? c.accentMuted : c.surface,
              },
            ]}
          >
            <Text style={{ color: c.text }} numberOfLines={1}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Button onPress={pickRandom} variant="secondary" style={{ marginBottom: spacing.md }}>
        Random exercise
      </Button>

      {listQuery.isPending ? (
        <Skeleton width="100%" height={120} />
      ) : listQuery.isError ? (
        <ErrorState message="Could not load exercises." onRetry={() => void listQuery.refetch()} />
      ) : (
        <View style={styles.listCol}>
          {filteredList.slice(0, 12).map((ex) => (
            <Pressable
              key={ex.id}
              onPress={() => setPickedId(ex.id)}
              style={[
                styles.row,
                { borderColor: c.border, backgroundColor: c.surface },
              ]}
            >
              <Text style={{ color: c.text, fontWeight: "600" }}>#{ex.id}</Text>
              <Text style={{ color: c.textMuted, marginLeft: spacing.sm }} numberOfLines={1}>
                {ex.type ?? "Exercise"} · {ex.category ?? "General"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {pickedId != null && detailQuery.isPending ? (
        <Skeleton width="100%" height={200} style={{ marginTop: spacing.lg }} />
      ) : detailQuery.data ? (
        <View style={{ marginTop: spacing.xl }}>
          <ExerciseSection
            exerciseType={String(detailQuery.data.type ?? "")}
            exerciseData={
              (detailQuery.data.exercise_data as Record<string, unknown>) ?? {}
            }
            exerciseId={detailQuery.data.id as number}
          />
        </View>
      ) : null}
    </ScreenScroll>
  );
}

export default function ExercisesTab() {
  return (
    <TabErrorBoundary>
      <ExercisesInner />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.lg },
  title: { fontSize: typography.xl, fontWeight: "800", marginBottom: spacing.xs },
  sub: { fontSize: typography.sm, marginBottom: spacing.lg, lineHeight: 20 },
  section: { fontSize: typography.sm, fontWeight: "700", marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.sm,
  },
  listCol: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
