import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
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
import ExerciseTimer from "../../src/components/exercises/ExerciseTimer";
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
import TabScreenHeader from "../../src/components/navigation/TabScreenHeader";
import { HeaderAvatarButton } from "../../src/components/navigation/HeaderAvatarButton";
import { HeaderRightButtons } from "../../src/components/navigation/HeaderRightButtons";

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

const SESSION_BATCH = 5;

const EXERCISE_TYPES = [
  { value: undefined, label: "All Types" },
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "numeric", label: "Numeric" },
  { value: "drag-and-drop", label: "Drag & Drop" },
  { value: "budget-allocation", label: "Budget" },
  { value: "fill-in-table", label: "Fill Table" },
  { value: "scenario-simulation", label: "Scenario" },
];

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

function difficultyColor(
  difficulty: string | undefined,
  colors: { success: string; accent: string; error: string },
) {
  const d = (difficulty ?? "").toLowerCase();
  if (d === "beginner") return colors.success;
  if (d === "intermediate") return colors.accent;
  if (d === "advanced") return colors.error;
  return colors.success;
}

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
  const [exerciseType, setExerciseType] = useState<string | undefined>(undefined);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [mode, setMode] = useState<PracticeMode>("normal");
  const [reviewItems, setReviewItems] = useState<ExerciseListItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewDone, setReviewDone] = useState<Record<number, true>>({});
  const [feedbackLine, setFeedbackLine] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    completed: 0,
    correctFirstTry: 0,
    startTime: Date.now(),
  });
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    if (categoryParam) setCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    hadIncorrectRef.current = false;
    setFeedbackLine("");
    setFeedbackTone(null);
    setHintIndex(0);
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

  const mergedCategory = categoryParam || category;

  const listQuery = useQuery({
    queryKey: [...queryKeys.exercises(), mergedCategory ?? "all"],
    queryFn: () =>
      fetchExercisesList(
        mergedCategory ? { category: mergedCategory } : undefined,
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

  const filteredList = useMemo(() => {
    if (mode === "review") return reviewItems;
    let items = list;
    if (exerciseType) items = items.filter((x) => x.type === exerciseType);
    return items;
  }, [list, exerciseType, mode, reviewItems]);

  // Auto-pick first exercise when filtered list changes
  useEffect(() => {
    if (filteredList.length > 0 && pickedId == null) {
      setPickedId(filteredList[0].id);
    } else if (filteredList.length > 0 && pickedId != null) {
      const stillInList = filteredList.some((x) => x.id === pickedId);
      if (!stillInList) setPickedId(filteredList[0].id);
    }
  }, [filteredList]);

  const pickedItem = useMemo(
    () => filteredList.find((x) => x.id === pickedId) ?? null,
    [filteredList, pickedId],
  );

  const pickedIndex = useMemo(() => {
    if (pickedId == null) return -1;
    return filteredList.findIndex((x) => x.id === pickedId);
  }, [filteredList, pickedId]);

  const progressFraction =
    pickedIndex >= 0 && filteredList.length > 0
      ? (pickedIndex + 1) / filteredList.length
      : 0;

  const timerSeconds = useMemo(() => {
    const d = detailQuery.data as Record<string, unknown> | undefined;
    if (!d) return 0;
    const raw = d.time_limit_seconds ?? d.time_limit ?? d.duration_seconds ?? d.timer_seconds;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(3600, Math.floor(n)) : 0;
  }, [detailQuery.data]);

  const hints = useMemo(() => {
    const d = detailQuery.data as Record<string, unknown> | undefined;
    const ed = d?.exercise_data as Record<string, unknown> | undefined;
    const h = ed?.hints;
    if (Array.isArray(h) && h.length > 0) return h as string[];
    return [];
  }, [detailQuery.data]);

  const fireConfetti = useCallback(() => {
    setTimeout(() => confettiRef.current?.start(), 200);
  }, []);

  const resetSessionTracking = useCallback(() => {
    uniqueCompletedRef.current = new Set();
    setSessionStats({ completed: 0, correctFirstTry: 0, startTime: Date.now() });
    setSummaryVisible(false);
    summaryShownRef.current = false;
  }, []);

  const dismissSummary = useCallback(() => setSummaryVisible(false), []);

  const skipToNext = useCallback(() => {
    if (pickedId == null) return;
    const idx = filteredList.findIndex((x) => x.id === pickedId);
    const next = filteredList[idx + 1] ?? filteredList[0];
    if (next && next.id !== pickedId) setPickedId(next.id);
  }, [filteredList, pickedId]);

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
      const correctFirstTry = s.correctFirstTry + (hadIncorrectRef.current ? 0 : 1);
      const next = { ...s, completed, correctFirstTry };
      if (pickedId != null) uniqueCompletedRef.current.add(pickedId);
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

    // Auto-advance after 1.2s
    setTimeout(() => {
      skipToNext();
      setFeedbackLine("");
      setFeedbackTone(null);
    }, 1200);
  }, [
    filteredList.length,
    fireConfetti,
    mode,
    pickedId,
    profileQuery,
    reviewQuery,
    skipToNext,
    t,
  ]);

  const onRefresh = useCallback(() => {
    void listQuery.refetch();
    void profileQuery.refetch();
    if (accessToken) void reviewQuery.refetch();
  }, [accessToken, listQuery, profileQuery, reviewQuery]);

  const accuracyPct =
    sessionStats.completed > 0
      ? Math.round((sessionStats.correctFirstTry / sessionStats.completed) * 100)
      : 0;
  const elapsedSec = Math.max(
    0,
    Math.round((Date.now() - sessionStats.startTime) / 1000),
  );

  const isListPending = mode === "normal" ? listQuery.isPending : reviewLoading;
  const isListError = mode === "normal" && listQuery.isError;
  const isFilteredEmpty =
    !isListPending && mode === "normal" && list.length > 0 && filteredList.length === 0;

  // Category label for dropdown button
  const categoryLabel = mergedCategory ?? "All Categories";
  const typeLabel =
    EXERCISE_TYPES.find((x) => x.value === exerciseType)?.label ?? "All Types";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TabScreenHeader
        title="Exercises"
        left={<HeaderAvatarButton />}
        right={<HeaderRightButtons />}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={[styles.container, { paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={listQuery.isFetching || profileQuery.isFetching || reviewQuery.isFetching}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
      >
        {/* ── Filters ── */}
        <View style={styles.filtersRow}>
          <Pressable
            onPress={() => setCategoryPickerOpen(true)}
            style={[styles.filterBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[styles.filterBtnText, { color: c.text }]} numberOfLines={1}>
              {categoryLabel}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>▾</Text>
          </Pressable>

          <Pressable
            onPress={() => setTypePickerOpen(true)}
            style={[styles.filterBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[styles.filterBtnText, { color: c.text }]} numberOfLines={1}>
              {typeLabel}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>▾</Text>
          </Pressable>
        </View>

        {/* ── Review mode banner ── */}
        {mode === "review" ? (
          <View style={[styles.reviewBanner, { backgroundColor: c.accentMuted }]}>
            <Text style={[styles.reviewBannerText, { color: c.text }]}>
              Review Mode — {reviewItems.length} due
            </Text>
            <Pressable onPress={exitReviewMode}>
              <Text style={{ color: c.primary, fontWeight: "700", fontSize: typography.sm }}>
                Exit
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Start review button ── */}
        {mode === "normal" && reviewCount > 0 && accessToken ? (
          <Pressable
            onPress={() => void startReviewMode()}
            style={[styles.reviewPrompt, { backgroundColor: c.surfaceOffset, borderColor: c.border }]}
          >
            <MaterialCommunityIcons name="sync" size={16} color={c.error} />
            <Text style={{ color: c.error, fontWeight: "700", fontSize: typography.sm }}>
              {reviewCount} review{reviewCount !== 1 ? "s" : ""} due — tap to start
            </Text>
          </Pressable>
        ) : null}

        {/* ── Loading / Error / Empty ── */}
        {isListPending ? (
          <Skeleton width="100%" height={200} style={{ marginBottom: spacing.md }} />
        ) : null}
        {isListError ? (
          <ErrorState
            message={t("exercises.errors.loadFailed")}
            onRetry={() => void listQuery.refetch()}
          />
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

        {/* ── Active exercise ── */}
        {!isListPending && !isListError && filteredList.length > 0 ? (
          <>
            {/* Meta row */}
            {pickedItem ? (
              <View style={styles.metaRow}>
                <View style={[styles.tag, { backgroundColor: c.surfaceOffset }]}>
                  <Text style={{ color: c.textMuted, fontSize: typography.xs }}>
                    {pickedItem.category ?? "—"}
                  </Text>
                </View>
                {pickedItem.difficulty ? (
                  <View
                    style={[
                      styles.tag,
                      {
                        backgroundColor: `${difficultyColor(pickedItem.difficulty, c)}22`,
                        borderColor: `${difficultyColor(pickedItem.difficulty, c)}55`,
                        borderWidth: 0.5,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: difficultyColor(pickedItem.difficulty, c),
                        fontSize: typography.xs,
                        fontWeight: "700",
                      }}
                    >
                      {labelForDifficulty(pickedItem.difficulty, t)}
                    </Text>
                  </View>
                ) : null}
                <Text style={{ color: c.textMuted, fontSize: typography.xs }}>
                  {pickedIndex + 1} / {filteredList.length}
                </Text>
              </View>
            ) : null}

            {/* Progress bar */}
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

            {/* Exercise card */}
            <GlassCard padding="md" style={{ marginBottom: spacing.md }}>
              {pickedId != null && timerSeconds > 0 ? (
                <ExerciseTimer key={pickedId} totalSeconds={timerSeconds} active />
              ) : null}

              {pickedId != null && detailQuery.isPending ? (
                <Skeleton width="100%" height={180} />
              ) : null}

              {pickedId != null && detailQuery.data ? (
                <ExerciseSection
                  exerciseType={String(detailQuery.data.type ?? "")}
                  exerciseData={
                    (detailQuery.data.exercise_data as Record<string, unknown>) ?? {}
                  }
                  exerciseId={detailQuery.data.id as number}
                  onAttempt={({ correct }) => {
                    if (!correct) {
                      hadIncorrectRef.current = true;
                      setFeedbackLine(t("exercises.practiceHub.feedbackTryAgain"));
                      setFeedbackTone("error");
                      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                  }}
                  onComplete={handleExerciseComplete}
                />
              ) : null}

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

            {/* Hints */}
            {hints.length > 0 ? (
              <View style={{ marginBottom: spacing.md }}>
                <Pressable
                  onPress={() => setHintIndex((i) => Math.min(i + 1, hints.length))}
                  style={[styles.hintBtn, { borderColor: c.border, backgroundColor: c.surface }]}
                >
                  <MaterialCommunityIcons name="lightbulb-outline" size={16} color={c.accent} />
                  <Text style={{ color: c.text, fontWeight: "600", fontSize: typography.sm }}>
                    {hintIndex < hints.length ? "Show hint" : "All hints shown"}
                  </Text>
                </Pressable>
                {hints.slice(0, hintIndex).map((h, i) => (
                  <View
                    key={i}
                    style={[styles.hintCard, { backgroundColor: c.surfaceOffset, borderColor: c.border }]}
                  >
                    <Text style={{ color: c.textMuted, fontSize: typography.sm, lineHeight: 20 }}>
                      {h}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Skip button */}
            <Button variant="secondary" onPress={skipToNext}>
              Skip →
            </Button>
          </>
        ) : null}

        {/* Review caught up */}
        {reviewCaughtUp ? (
          <GlassCard padding="md" style={{ marginTop: spacing.md }}>
            <Text style={{ color: c.text, fontSize: typography.sm, lineHeight: 20 }}>
              {t("exercises.practiceHub.reviewUpToDate")}
            </Text>
            <Button onPress={exitReviewMode} style={{ marginTop: spacing.sm }} variant="secondary">
              {t("exercises.practiceHub.backToNormal")}
            </Button>
          </GlassCard>
        ) : null}
      </ScrollView>

      {/* Category picker modal */}
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            onPress={() => setCategoryPickerOpen(false)}
          />
          <View style={[styles.pickerSheet, { backgroundColor: c.surface }]}>
            <View style={[styles.dragHandle, { backgroundColor: c.border }]} />
            <Text style={[styles.pickerTitle, { color: c.text }]}>Category</Text>
            <ScrollView>
              <Pressable
                onPress={() => { setCategory(undefined); setCategoryPickerOpen(false); }}
                style={styles.pickerOption}
              >
                <Text style={{ color: c.text, fontSize: typography.base }}>All Categories</Text>
                {!mergedCategory ? (
                  <MaterialCommunityIcons name="check" size={18} color={c.primary} />
                ) : null}
              </Pressable>
              {(categoriesQuery.data ?? []).map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => { setCategory(cat); setCategoryPickerOpen(false); }}
                  style={styles.pickerOption}
                >
                  <Text style={{ color: c.text, fontSize: typography.base }}>{cat}</Text>
                  {mergedCategory === cat ? (
                    <MaterialCommunityIcons name="check" size={18} color={c.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Type picker modal */}
      <Modal
        visible={typePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            onPress={() => setTypePickerOpen(false)}
          />
          <View style={[styles.pickerSheet, { backgroundColor: c.surface }]}>
            <View style={[styles.dragHandle, { backgroundColor: c.border }]} />
            <Text style={[styles.pickerTitle, { color: c.text }]}>Exercise Type</Text>
            <ScrollView>
              {EXERCISE_TYPES.map((opt) => (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => { setExerciseType(opt.value); setTypePickerOpen(false); }}
                  style={styles.pickerOption}
                >
                  <Text style={{ color: c.text, fontSize: typography.base }}>{opt.label}</Text>
                  {exerciseType === opt.value ? (
                    <MaterialCommunityIcons name="check" size={18} color={c.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Session summary modal */}
      <Modal
        visible={summaryVisible}
        transparent
        animationType="slide"
        onRequestClose={dismissSummary}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            onPress={dismissSummary}
          />
          <View style={styles.modalSheet}>
            <GlassCard padding="lg">
              <Text style={[styles.summaryTitle, { color: c.text }]}>
                {t("exercises.practiceHub.sessionSummaryTitle")}
              </Text>
              <Text style={{ color: c.textMuted, marginTop: spacing.xs, lineHeight: 20 }}>
                {t("exercises.practiceHub.sessionSummaryBody", {
                  completed: sessionStats.completed,
                  accuracy: accuracyPct,
                  seconds: elapsedSec,
                })}
              </Text>
              <View style={styles.summaryActions}>
                <Button
                  variant="secondary"
                  onPress={() => { resetSessionTracking(); void startReviewMode(); }}
                  disabled={!reviewCount}
                >
                  {t("exercises.practiceHub.doReviews")}
                </Button>
                <Button onPress={() => { resetSessionTracking(); skipToNext(); }}>
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
    </View>
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
  filtersRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.xs,
    minHeight: 44,
  },
  filterBtnText: {
    flex: 1,
    fontSize: typography.sm,
    fontWeight: "600",
  },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  reviewBannerText: { fontSize: typography.sm, fontWeight: "700" },
  reviewPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  progressFill: { height: "100%", borderRadius: 3 },
  feedbackLine: {
    marginTop: spacing.md,
    fontSize: typography.sm,
    fontWeight: "600",
  },
  hintBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.sm,
  },
  hintCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.sm,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalSheet: { padding: spacing.md, paddingBottom: spacing.xxl },
  pickerSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  pickerTitle: {
    fontSize: typography.md,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  summaryTitle: { fontSize: typography.md, fontWeight: "800" },
  summaryActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
    flexDirection: "column",
  },
});
