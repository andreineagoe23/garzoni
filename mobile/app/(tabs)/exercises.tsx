import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  fetchExerciseById,
  fetchExerciseCategories,
  fetchExercisesList,
  fetchProfile,
  fetchReviewQueue,
  queryKeys,
  staleTimes,
} from "@garzoni/core";
import ExerciseSection from "../../src/components/lesson/ExerciseSection";
import MascotWithMessage from "../../src/components/common/MascotWithMessage";
import ExerciseTimer from "../../src/components/exercises/ExerciseTimer";
import StreakBanner from "../../src/components/exercises/StreakBanner";
import SwipeableExerciseCard from "../../src/components/exercises/SwipeableExerciseCard";
import { exerciseTypeIconName } from "../../src/components/exercises/exerciseTypeIcon";
import {
  Button,
  ErrorState,
  GlassCard,
  Skeleton,
} from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { useAuthSession } from "../../src/auth/AuthContext";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../src/theme/tokens";

type ExerciseListItem = {
  id: number;
  type?: string;
  category?: string;
  difficulty?: string;
};

type ReviewDueItem = {
  exercise_id: number;
  skill?: string;
  question?: string;
  type?: string;
};

type PracticeMode = "normal" | "review";

const TAB_BAR_CONTENT_PAD = 72;

function truncateText(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function labelForExerciseType(
  type: string | undefined,
  t: TFunction<"common">,
) {
  const key = type?.trim() ?? "";
  const map: Record<string, string> = {
    "multiple-choice": "exercises.filters.multipleChoice",
    numeric: "exercises.filters.numeric",
    "drag-and-drop": "exercises.filters.dragDrop",
    "budget-allocation": "exercises.filters.budget",
    "fill-in-table": "exercises.filters.fillTable",
    "scenario-simulation": "exercises.filters.scenario",
  };
  if (map[key]) return t(map[key]);
  return t("exercises.practiceHub.genericDrill");
}

function labelForDifficulty(
  difficulty: string | undefined,
  t: TFunction<"common">,
): string | undefined {
  if (!difficulty) return undefined;
  const map: Record<string, string> = {
    beginner: "exercises.filters.beginner",
    intermediate: "exercises.filters.intermediate",
    advanced: "exercises.filters.advanced",
  };
  const k = difficulty.toLowerCase();
  return map[k] ? t(map[k]) : difficulty;
}

const SESSION_BATCH = 5;

function ExercisesInner() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const { hydrated, accessToken } = useAuthSession();
  const confettiRef = useRef<ConfettiCannon>(null);
  const hadIncorrectRef = useRef(false);
  const uniqueCompletedRef = useRef<Set<number>>(new Set());
  const summaryShownRef = useRef(false);

  const { category: categoryParam, skill: skillParam } = useLocalSearchParams<{
    category?: string;
    skill?: string;
  }>();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [mode, setMode] = useState<PracticeMode>("normal");
  const [reviewItems, setReviewItems] = useState<ExerciseListItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDone, setReviewDone] = useState<Record<number, true>>({});
  const [feedbackLine, setFeedbackLine] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | null>(
    null,
  );
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    completed: 0,
    correctFirstTry: 0,
    startTime: Date.now(),
  });

  useEffect(() => {
    if (categoryParam) setCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    hadIncorrectRef.current = false;
    setFeedbackLine("");
    setFeedbackTone(null);
  }, [pickedId]);

  useEffect(() => {
    if (summaryVisible && !summaryShownRef.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    summaryShownRef.current = summaryVisible;
  }, [summaryVisible]);

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
        initialCategory ? { category: initialCategory } : undefined,
      ).then((r) => r.data as ExerciseListItem[]),
    staleTime: staleTimes.progressSummary,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
    enabled: hydrated && Boolean(accessToken),
  });

  const reviewQuery = useQuery({
    queryKey: queryKeys.reviewQueue(),
    queryFn: () =>
      fetchReviewQueue().then(
        (r) => r.data as { due?: ReviewDueItem[]; count?: number },
      ),
    staleTime: staleTimes.progressSummary,
    enabled: hydrated && Boolean(accessToken),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.exerciseDetail(pickedId ?? 0),
    queryFn: () =>
      fetchExerciseById(pickedId!).then(
        (r) => r.data as Record<string, unknown>,
      ),
    enabled: pickedId != null,
  });

  const list = listQuery.data ?? [];
  const mergedCategory = categoryParam || category;

  const filteredList = useMemo(() => {
    if (mode === "review") return reviewItems;
    if (!mergedCategory) return list;
    return list.filter(
      (x) => (x.category || "").toLowerCase() === mergedCategory.toLowerCase(),
    );
  }, [list, mergedCategory, mode, reviewItems]);

  const isListPending =
    (mode === "normal" && listQuery.isPending) ||
    (mode === "review" && reviewLoading);
  const isListError = mode === "normal" && listQuery.isError;
  const isReviewEmpty =
    mode === "review" && !reviewItems.length && !reviewLoading;
  const isFilteredEmpty =
    mode === "normal" && list.length > 0 && filteredList.length === 0;
  const listReady =
    !isListPending && !isListError && !isReviewEmpty && !isFilteredEmpty;

  const pickRandom = useCallback(() => {
    const pool = filteredList;
    if (!pool.length) return;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    setPickedId(choice.id);
  }, [filteredList]);

  const skipToNext = useCallback(
    (currentId: number) => {
      const idx = filteredList.findIndex((x) => x.id === currentId);
      const next = filteredList[idx + 1] ?? filteredList[0];
      if (next && next.id !== currentId) setPickedId(next.id);
    },
    [filteredList],
  );

  const streak = Number(
    (profileQuery.data as { streak?: number } | undefined)?.streak ?? 0,
  );

  const timerSeconds = useMemo(() => {
    const d = detailQuery.data as Record<string, unknown> | undefined;
    if (!d) return 0;
    const raw =
      d.time_limit_seconds ??
      d.time_limit ??
      d.duration_seconds ??
      d.timer_seconds;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(3600, Math.floor(n)) : 0;
  }, [detailQuery.data]);

  const fireConfetti = useCallback(() => {
    setTimeout(() => confettiRef.current?.start(), 200);
  }, []);

  const resetSessionTracking = useCallback(() => {
    uniqueCompletedRef.current = new Set();
    setSessionStats({
      completed: 0,
      correctFirstTry: 0,
      startTime: Date.now(),
    });
    setSummaryVisible(false);
    summaryShownRef.current = false;
  }, []);

  const dismissSummary = useCallback(() => {
    setSummaryVisible(false);
  }, []);

  const exitReviewMode = useCallback(() => {
    setMode("normal");
    setReviewItems([]);
    setReviewDone({});
    setPickedId(null);
    void reviewQuery.refetch();
  }, [reviewQuery]);

  const startReviewMode = useCallback(async () => {
    const due = reviewQuery.data?.due ?? [];
    if (!due.length || !accessToken) return;
    setReviewLoading(true);
    try {
      const details = await Promise.all(
        due.map((item) =>
          fetchExerciseById(item.exercise_id).then(
            (r) => r.data as Record<string, unknown>,
          ),
        ),
      );
      const items: ExerciseListItem[] = details.map((d) => ({
        id: Number(d.id),
        type: d.type as string | undefined,
        category: (d.category as string | undefined) ?? undefined,
        difficulty: d.difficulty as string | undefined,
      }));
      setReviewItems(items);
      setReviewDone({});
      setMode("review");
      setPickedId(items[0]?.id ?? null);
      resetSessionTracking();
    } catch {
      setFeedbackLine(t("exercises.practiceHub.loadReviewsError"));
      setFeedbackTone("error");
    } finally {
      setReviewLoading(false);
    }
  }, [accessToken, reviewQuery.data?.due, resetSessionTracking, t]);

  const reviewDue = reviewQuery.data?.due ?? [];
  const reviewCount = reviewQuery.data?.count ?? reviewDue.length;

  const pickedIndex = useMemo(() => {
    if (pickedId == null) return -1;
    return filteredList.findIndex((x) => x.id === pickedId);
  }, [filteredList, pickedId]);

  const progressFraction =
    pickedIndex >= 0 && filteredList.length > 0
      ? (pickedIndex + 1) / filteredList.length
      : 0;

  const reviewCaughtUp =
    mode === "review" &&
    reviewItems.length > 0 &&
    Object.keys(reviewDone).length >= reviewItems.length;

  const handleExerciseComplete = useCallback(() => {
    fireConfetti();
    setFeedbackLine(t("exercises.practiceHub.feedbackCorrect"));
    setFeedbackTone("success");

    if (mode === "review" && pickedId != null) {
      setReviewDone((d) => ({ ...d, [pickedId]: true }));
    }

    setSessionStats((s) => {
      const completed = s.completed + 1;
      const correctFirstTry =
        s.correctFirstTry + (hadIncorrectRef.current ? 0 : 1);
      const next = { ...s, completed, correctFirstTry };

      if (pickedId != null) {
        uniqueCompletedRef.current.add(pickedId);
      }
      const uniq = uniqueCompletedRef.current.size;
      const total = filteredList.length;
      const allTouched = total > 0 && uniq >= total;
      const batchDone = completed >= SESSION_BATCH;
      if (batchDone || allTouched) {
        queueMicrotask(() => setSummaryVisible(true));
      }

      return next;
    });

    void reviewQuery.refetch();
    void profileQuery.refetch();
  }, [
    filteredList.length,
    fireConfetti,
    mode,
    pickedId,
    profileQuery,
    reviewQuery,
    t,
  ]);

  const onRefresh = useCallback(() => {
    void listQuery.refetch();
    void profileQuery.refetch();
    if (accessToken) void reviewQuery.refetch();
  }, [accessToken, listQuery, profileQuery, reviewQuery]);

  const accuracyPct =
    sessionStats.completed > 0
      ? Math.round(
          (sessionStats.correctFirstTry / sessionStats.completed) * 100,
        )
      : 0;
  const elapsedSec = Math.max(
    0,
    Math.round((Date.now() - sessionStats.startTime) / 1000),
  );

  const renderExerciseItem = useCallback(
    ({ item: ex }: { item: ExerciseListItem }) => {
      const selected = pickedId === ex.id;
      const typeLabel = labelForExerciseType(ex.type, t);
      const diffLabel = labelForDifficulty(ex.difficulty, t);
      const iconName = exerciseTypeIconName(ex.type) as ComponentProps<
        typeof MaterialCommunityIcons
      >["name"];

      return (
        <SwipeableExerciseCard
          onStart={() => setPickedId(ex.id)}
          onSkipNext={() => skipToNext(ex.id)}
        >
          <Pressable
            onPress={() => setPickedId(ex.id)}
            style={[
              styles.row,
              {
                borderColor: selected ? c.primary : c.border,
                backgroundColor: selected ? c.accentMuted : c.surface,
                borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View
              style={[
                styles.typeIconWrap,
                { backgroundColor: selected ? c.surface : c.surfaceOffset },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <MaterialCommunityIcons
                name={iconName}
                size={22}
                color={c.primary}
              />
            </View>
            <View style={styles.rowMain}>
              <Text
                style={{
                  color: c.text,
                  fontWeight: "800",
                  fontSize: typography.md,
                }}
                numberOfLines={2}
              >
                {typeLabel}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.tag, { backgroundColor: c.surface }]}>
                  <Text
                    style={{ color: c.textMuted, fontSize: typography.xs }}
                    numberOfLines={1}
                  >
                    {ex.category ?? "—"}
                  </Text>
                </View>
                {diffLabel ? (
                  <View style={[styles.tag, { backgroundColor: c.surface }]}>
                    <Text
                      style={{ color: c.textMuted, fontSize: typography.xs }}
                    >
                      {diffLabel}
                    </Text>
                  </View>
                ) : null}
                <Text style={{ color: c.textMuted, fontSize: typography.xs }}>
                  #{ex.id}
                </Text>
              </View>
            </View>
          </Pressable>
        </SwipeableExerciseCard>
      );
    },
    [c, pickedId, skipToNext, t],
  );

  const listEmptyCopy = useMemo(() => {
    if (!listReady) return null;
    if (filteredList.length > 0) return null;
    if (list.length === 0) return t("exercises.practiceHub.emptyDrills");
    return t("exercises.emptyFiltered.subtitle");
  }, [filteredList.length, list.length, listReady, t]);

  const listHeader = useMemo(
    () => (
      <>
        <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
          <View style={styles.heroRow}>
            <View style={styles.heroLeft}>
              <View style={styles.heroTitleRow}>
                <Text style={[styles.title, { color: c.text }]}>
                  {t("exercises.practiceHub.title")}
                </Text>
                {mode === "review" ? (
                  <View
                    style={[
                      styles.modeBadge,
                      { backgroundColor: c.accentMuted },
                    ]}
                  >
                    <Text style={[styles.modeBadgeText, { color: c.accent }]}>
                      {t("exercises.practiceHub.reviewMode")}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.sub, { color: c.textMuted }]}>
                {t("exercises.practiceHub.subtitle")}
              </Text>
              <StreakBanner streakCount={streak} style={{ marginBottom: 0 }} />
            </View>
            <View style={styles.heroMascot}>
              <MascotWithMessage
                mood="encourage"
                rotationKey={2}
                embedded
                mascotSize={52}
              />
            </View>
          </View>
        </GlassCard>

        {mergedCategory && mode === "normal" ? (
          <View
            style={[styles.practicingPill, { backgroundColor: c.accentMuted }]}
          >
            <Text
              style={[styles.practicingPillText, { color: c.text }]}
              numberOfLines={1}
            >
              {t("exercises.practiceHub.practicing", {
                category: mergedCategory,
              })}
            </Text>
          </View>
        ) : null}

        {accessToken ? (
          <GlassCard padding="sm" style={{ marginBottom: spacing.md }}>
            {reviewCount > 0 ? (
              <>
                <Text style={[styles.reviewLine, { color: c.text }]}>
                  {t("exercises.practiceHub.reviewsDue", {
                    count: reviewCount,
                  })}
                </Text>
                {reviewDue[0] ? (
                  <Text
                    style={[styles.reviewNext, { color: c.textMuted }]}
                    numberOfLines={3}
                  >
                    {t("exercises.reviewQueue.nextUp", {
                      skill: reviewDue[0].skill ?? "",
                      question: truncateText(reviewDue[0].question ?? "—", 120),
                    })}
                  </Text>
                ) : null}
                <Button
                  onPress={() => void startReviewMode()}
                  disabled={reviewLoading || !reviewDue.length}
                  style={{ marginTop: spacing.sm }}
                >
                  {reviewLoading ? "…" : t("exercises.practiceHub.doReviews")}
                </Button>
              </>
            ) : (
              <Text style={{ color: c.textMuted, fontSize: typography.sm }}>
                {t("exercises.reviewQueue.emptyTitle")}
              </Text>
            )}
          </GlassCard>
        ) : null}

        {mode === "review" ? (
          <Button
            variant="secondary"
            onPress={exitReviewMode}
            style={{ marginBottom: spacing.md }}
          >
            {t("exercises.practiceHub.backToNormal")}
          </Button>
        ) : null}

        {mode === "normal" ? (
          <>
            <Text style={[styles.section, { color: c.accent }]}>
              {t("exercises.practiceHub.pickSkillArea")}
            </Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.sm }}
            >
              <Pressable
                onPress={() => setCategory(undefined)}
                style={[
                  styles.chip,
                  {
                    borderColor: c.border,
                    backgroundColor: !mergedCategory ? c.primary : c.surface,
                    minHeight: 44,
                    justifyContent: "center",
                  },
                ]}
              >
                <Text
                  style={{
                    color: !mergedCategory ? c.textOnPrimary : c.text,
                    fontWeight: !mergedCategory ? "800" : "600",
                  }}
                >
                  {t("exercises.practiceHub.allChip")}
                </Text>
              </Pressable>
              {(categoriesQuery.data ?? []).map((cat) => {
                const selected = mergedCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.chip,
                      {
                        borderColor: c.border,
                        backgroundColor: selected ? c.primary : c.surface,
                        minHeight: 44,
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? c.textOnPrimary : c.text,
                        fontWeight: selected ? "800" : "600",
                      }}
                      numberOfLines={1}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={pickRandom}
              style={[
                styles.randomPill,
                {
                  borderColor: c.border,
                  backgroundColor: c.surface,
                  marginBottom: spacing.md,
                  minHeight: 44,
                  justifyContent: "center",
                },
              ]}
            >
              <Text style={{ color: c.text, fontWeight: "700" }}>
                {t("exercises.practiceHub.randomExercise")}
              </Text>
            </Pressable>
          </>
        ) : null}

        {reviewCaughtUp ? (
          <GlassCard padding="md" style={{ marginBottom: spacing.md }}>
            <Text
              style={{ color: c.text, fontSize: typography.sm, lineHeight: 20 }}
            >
              {t("exercises.practiceHub.reviewUpToDate")}
            </Text>
            <Button
              onPress={exitReviewMode}
              style={{ marginTop: spacing.sm }}
              variant="secondary"
            >
              {t("exercises.practiceHub.backToNormal")}
            </Button>
          </GlassCard>
        ) : null}

        {isListPending ? (
          <Skeleton
            width="100%"
            height={120}
            style={{ marginBottom: spacing.md }}
          />
        ) : null}
        {isListError ? (
          <ErrorState
            message={t("exercises.errors.loadFailed")}
            onRetry={() => void listQuery.refetch()}
          />
        ) : null}
        {isReviewEmpty ? (
          <Text style={{ color: c.textMuted, marginBottom: spacing.md }}>
            {t("exercises.reviewQueue.emptySubtitle")}
          </Text>
        ) : null}
        {isFilteredEmpty ? (
          <GlassCard padding="md" style={{ marginBottom: spacing.md }}>
            <Text style={{ color: c.text, fontWeight: "700" }}>
              {t("exercises.emptyFiltered.title")}
            </Text>
            <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
              {t("exercises.emptyFiltered.subtitle")}
            </Text>
          </GlassCard>
        ) : null}
      </>
    ),
    [
      accessToken,
      c,
      categoriesQuery.data,
      exitReviewMode,
      isFilteredEmpty,
      isListError,
      isListPending,
      isReviewEmpty,
      listQuery,
      mergedCategory,
      mode,
      pickRandom,
      reviewCaughtUp,
      reviewCount,
      reviewDue,
      reviewLoading,
      startReviewMode,
      streak,
      t,
    ],
  );

  const listFooter = useMemo(
    () => (
      <>
        {pickedId != null && detailQuery.isPending ? (
          <Skeleton
            width="100%"
            height={200}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}
        {pickedId != null && detailQuery.data ? (
          <GlassCard padding="md" style={{ marginTop: spacing.xl }}>
            <View style={styles.activeHeader}>
              <Text
                style={{
                  color: c.textMuted,
                  fontSize: typography.sm,
                  fontWeight: "600",
                }}
              >
                {t("exercises.practiceHub.progressLabel", {
                  current: pickedIndex >= 0 ? pickedIndex + 1 : 0,
                  total: filteredList.length || 0,
                })}
              </Text>
              {timerSeconds > 0 ? (
                <ExerciseTimer
                  key={pickedId ?? 0}
                  totalSeconds={timerSeconds}
                  active
                />
              ) : null}
            </View>
            <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, Math.round(progressFraction * 100))}%`,
                    backgroundColor: c.primary,
                  },
                ]}
              />
            </View>
            <ExerciseSection
              exerciseType={String(detailQuery.data.type ?? "")}
              exerciseData={
                (detailQuery.data.exercise_data as Record<string, unknown>) ??
                {}
              }
              exerciseId={detailQuery.data.id as number}
              onAttempt={({ correct }) => {
                if (!correct) {
                  hadIncorrectRef.current = true;
                  setFeedbackLine(t("exercises.practiceHub.feedbackTryAgain"));
                  setFeedbackTone("error");
                  void Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Error,
                  );
                }
              }}
              onComplete={handleExerciseComplete}
            />
            {feedbackLine ? (
              <Text
                style={[
                  styles.feedbackLine,
                  {
                    color:
                      feedbackTone === "success"
                        ? c.success
                        : feedbackTone === "error"
                          ? c.error
                          : c.textMuted,
                  },
                ]}
              >
                {feedbackLine}
              </Text>
            ) : null}
          </GlassCard>
        ) : null}
      </>
    ),
    [
      c,
      detailQuery.data,
      detailQuery.isPending,
      feedbackLine,
      feedbackTone,
      filteredList.length,
      handleExerciseComplete,
      pickedId,
      pickedIndex,
      progressFraction,
      t,
      timerSeconds,
    ],
  );

  return (
    <>
      <FlatList
        data={listReady ? filteredList : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderExerciseItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          listEmptyCopy ? (
            <Text style={{ color: c.textMuted, paddingVertical: spacing.md }}>
              {listEmptyCopy}
            </Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: c.bg,
            paddingBottom: TAB_BAR_CONTENT_PAD + spacing.xl,
          },
        ]}
        style={{ flex: 1, backgroundColor: c.bg }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={
              listQuery.isFetching ||
              profileQuery.isFetching ||
              reviewQuery.isFetching
            }
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
      />

      <Modal
        visible={summaryVisible}
        transparent
        animationType="slide"
        onRequestClose={dismissSummary}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]}
            onPress={dismissSummary}
            accessibilityRole="button"
            accessibilityLabel={t(
              "exercises.practiceHub.sessionSummaryDismiss",
            )}
          />
          <View style={styles.modalSheet}>
            <GlassCard padding="lg">
              <Text style={[styles.summaryTitle, { color: c.text }]}>
                {t("exercises.practiceHub.sessionSummaryTitle")}
              </Text>
              <Text
                style={{
                  color: c.textMuted,
                  marginTop: spacing.xs,
                  lineHeight: 20,
                }}
              >
                {t("exercises.practiceHub.sessionSummaryBody", {
                  completed: sessionStats.completed,
                  accuracy: accuracyPct,
                  seconds: elapsedSec,
                })}
              </Text>
              <View style={styles.summaryActions}>
                <Button
                  variant="secondary"
                  onPress={() => {
                    resetSessionTracking();
                    void startReviewMode();
                  }}
                  disabled={!reviewCount}
                >
                  {t("exercises.practiceHub.doReviews")}
                </Button>
                <Button
                  onPress={() => {
                    resetSessionTracking();
                    pickRandom();
                  }}
                >
                  {t("exercises.practiceHub.moreExercises")}
                </Button>
                <Button variant="ghost" onPress={dismissSummary}>
                  {t("exercises.practiceHub.sessionSummaryDismiss")}
                </Button>
              </View>
            </GlassCard>
          </View>
        </View>
      </Modal>

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
  container: { padding: spacing.xl },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalSheet: { padding: spacing.md, paddingBottom: spacing.xxl },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  heroLeft: { flex: 1, minWidth: 0 },
  heroMascot: { maxWidth: 140 },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  title: { fontSize: typography.xl, fontWeight: "800" },
  sub: {
    fontSize: typography.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  modeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  practicingPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  practicingPillText: { fontSize: typography.sm, fontWeight: "700" },
  reviewLine: { fontSize: typography.sm, fontWeight: "700" },
  reviewNext: { fontSize: typography.sm, marginTop: spacing.xs },
  section: {
    fontSize: typography.sm,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.sm,
  },
  randomPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: { flex: 1, minWidth: 0, gap: spacing.xs },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  activeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  progressFill: { height: "100%", borderRadius: 2 },
  feedbackLine: {
    marginTop: spacing.md,
    fontSize: typography.sm,
    fontWeight: "600",
  },
  summaryTitle: { fontSize: typography.md, fontWeight: "800" },
  summaryActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
    flexDirection: "column",
  },
});
