import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import {
  fetchExerciseById,
  fetchExerciseCategories,
  fetchExercisesList,
  fetchProfile,
  queryKeys,
  staleTimes,
} from "@monevo/core";
import ExerciseSection from "../../src/components/lesson/ExerciseSection";
import MascotWithMessage from "../../src/components/common/MascotWithMessage";
import ExerciseTimer from "../../src/components/exercises/ExerciseTimer";
import StreakBanner from "../../src/components/exercises/StreakBanner";
import SwipeableExerciseCard from "../../src/components/exercises/SwipeableExerciseCard";
import { Button, ErrorState, ScreenScroll, Skeleton } from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { useAuthSession } from "../../src/auth/AuthContext";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../src/theme/tokens";
import { Pressable } from "react-native";

type ExerciseListItem = { id: number; type?: string; category?: string };

function ExercisesInner() {
  const c = useThemeColors();
  const { hydrated, accessToken } = useAuthSession();
  const confettiRef = useRef<ConfettiCannon>(null);
  const { category: categoryParam, skill: skillParam } = useLocalSearchParams<{
    category?: string;
    skill?: string;
  }>();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [pickedId, setPickedId] = useState<number | null>(null);

  useEffect(() => {
    if (categoryParam) setCategory(categoryParam);
  }, [categoryParam]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.exerciseCategories(),
    queryFn: () => fetchExerciseCategories().then((r) => r.data as string[]),
    staleTime: staleTimes.content,
  });

  useEffect(() => {
    if (!skillParam || categoryParam) return;
    const decoded = decodeURIComponent(skillParam);
    const cats = categoriesQuery.data ?? [];
    const exact = cats.find((x) => x.toLowerCase() === decoded.toLowerCase());
    setCategory(exact ?? decoded);
  }, [skillParam, categoryParam, categoriesQuery.data]);

  const initialCategory = categoryParam ?? category;
  const listQuery = useQuery({
    queryKey: [...queryKeys.exercises(), initialCategory ?? "all"],
    queryFn: () =>
      fetchExercisesList(
        initialCategory ? { category: initialCategory } : undefined
      ).then((r) => r.data as ExerciseListItem[]),
    staleTime: staleTimes.progressSummary,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
    enabled: hydrated && Boolean(accessToken),
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

  const skipToNext = useCallback(
    (currentId: number) => {
      const idx = filteredList.findIndex((x) => x.id === currentId);
      const next = filteredList[idx + 1] ?? filteredList[0];
      if (next && next.id !== currentId) setPickedId(next.id);
    },
    [filteredList]
  );

  const streak = Number(
    (profileQuery.data as { streak?: number } | undefined)?.streak ?? 0
  );

  const timerSeconds = useMemo(() => {
    const d = detailQuery.data as Record<string, unknown> | undefined;
    if (!d) return 0;
    const raw =
      d.time_limit_seconds ?? d.time_limit ?? d.duration_seconds ?? d.timer_seconds;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(3600, Math.floor(n)) : 0;
  }, [detailQuery.data]);

  const fireConfetti = useCallback(() => {
    setTimeout(() => confettiRef.current?.start(), 200);
  }, []);

  return (
    <>
    <ScreenScroll
      contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={
        <RefreshControl
          refreshing={listQuery.isFetching || profileQuery.isFetching}
          onRefresh={() => {
            void listQuery.refetch();
            void profileQuery.refetch();
          }}
          tintColor={c.primary}
        />
      }
    >
      <Text style={[styles.title, { color: c.text }]}>Exercises</Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        Practice with standalone drills. Pick a category or go random.
      </Text>

      <MascotWithMessage mood="encourage" rotationKey={2} />

      <StreakBanner streakCount={streak} />

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
            <SwipeableExerciseCard
              key={ex.id}
              onStart={() => setPickedId(ex.id)}
              onSkipNext={() => skipToNext(ex.id)}
            >
              <Pressable
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
            </SwipeableExerciseCard>
          ))}
        </View>
      )}

      {pickedId != null && detailQuery.isPending ? (
        <Skeleton width="100%" height={200} style={{ marginTop: spacing.lg }} />
      ) : detailQuery.data ? (
        <View style={{ marginTop: spacing.xl }}>
          {timerSeconds > 0 ? (
            <ExerciseTimer key={pickedId ?? 0} totalSeconds={timerSeconds} active />
          ) : null}
          <ExerciseSection
            exerciseType={String(detailQuery.data.type ?? "")}
            exerciseData={
              (detailQuery.data.exercise_data as Record<string, unknown>) ?? {}
            }
            exerciseId={detailQuery.data.id as number}
            onAttempt={({ correct }) => {
              if (!correct) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
            }}
            onComplete={fireConfetti}
          />
        </View>
      ) : null}
    </ScreenScroll>
    <ConfettiCannon
      ref={confettiRef}
      count={72}
      origin={{ x: -10, y: 0 }}
      fadeOut
      autoStart={false}
      colors={["#ffd700", c.primary, "#ffffff", c.accent]}
    />
    </>
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
