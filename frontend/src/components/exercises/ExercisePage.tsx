import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import apiClient from "services/httpClient";
import { useAuth } from "contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { GlassCard } from "components/ui";
import MascotMedia from "components/common/MascotMedia";
import MascotWithMessage from "components/common/MascotWithMessage";
import { MonevoIcon } from "components/ui/monevoIcons";
import { formatNumber, getLocale } from "utils/format";
import { playFeedbackChime } from "utils/sound";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "hooks/useAnalytics";
import { useExerciseSkillIntent } from "hooks/useExerciseSkillIntent";
import ExerciseIntentBanner from "./ExerciseIntentBanner";
import ExerciseIntentLessonEmpty from "./ExerciseIntentLessonEmpty";

const LESSON_SESSION_STORAGE_KEY = "monevo_exercise_lesson_session_v1";
const SUPPORTS_PROGRESS_BATCH_STORAGE_KEY = "monevo_supports_progress_batch_v1";
const MAX_VISIBLE_PROGRESS_ITEMS = 8;

const ExercisePage = () => {
  const { t } = useTranslation();
  const locale = getLocale();
  const [exercises, setExercises] = useState([]);
  const [lessonExercises, setLessonExercises] = useState([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState(null);
  const [progress, setProgress] = useState([]);
  const [showCorrection, setShowCorrection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [filters, setFilters] = useState({
    type: "",
    category: "",
    difficulty: "",
  });
  const [categories, setCategories] = useState([]);
  const { isInitialized, isAuthenticated, entitlements, settings } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const [streak, setStreak] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalExercises: 0,
    averageAccuracy: 0,
    averageAttempts: 0,
    totalTimeSpent: 0,
    firstTryAccuracy: 0,
  });
  const [startTime, setStartTime] = useState(Date.now());
  const [isTimedMode, setIsTimedMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef(null);
  const [savedAnswers, setSavedAnswers] = useState({});
  const [isRetrying, setIsRetrying] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [hintError, setHintError] = useState("");
  const [scratchpad, setScratchpad] = useState("");
  const [calculatorValue, setCalculatorValue] = useState("");
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState("");
  const [reviewQueue, setReviewQueue] = useState({ due: [], count: 0 });
  const [xpTotal, setXpTotal] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [mode, setMode] = useState("lesson");
  const [skillGains, setSkillGains] = useState({});
  const [skillProficiency, setSkillProficiency] = useState({});
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1);
  const [inlineHint, setInlineHint] = useState("");
  const [listRefreshing, setListRefreshing] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [recentSkillInsight, setRecentSkillInsight] = useState("");
  const inlineHintTimeoutRef = useRef(null);
  const skillInsightTimeoutRef = useRef(null);
  const isDevelopment = import.meta.env.DEV;
  const mascotTimeoutRef = useRef(null);
  const mascotInteractionCountRef = useRef(0);
  const exercisesBootRef = useRef(false);
  const exercisesFetchGenerationRef = useRef(0);
  const exercisesAbortRef = useRef<AbortController | null>(null);
  const supportsProgressBatchRef = useRef<boolean>(
    (() => {
      try {
        return (
          sessionStorage.getItem(SUPPORTS_PROGRESS_BATCH_STORAGE_KEY) !==
          "false"
        );
      } catch {
        return true;
      }
    })()
  );
  const lastLessonSessionRestoreKeyRef = useRef<string | null>(null);
  const filtersRef = useRef(filters);
  const [categoriesResolved, setCategoriesResolved] = useState(false);
  filtersRef.current = filters;

  const onIntentMatchedApplyLessonReset = useCallback(() => {
    setCurrentExerciseIndex(0);
    setProgress([]);
    setShowCorrection(false);
    setUserAnswer(null);
    setSubmissionFeedback("");
    setExplanation("");
    setInlineHint("");
    setSavedAnswers({});
    setSessionCompleted(false);
  }, []);

  const {
    targetSkillIntent,
    intentReason,
    intentFromDashboard,
    intentSource,
    skillFetchReady,
    intentResolution,
    skillIntentBanner,
    skillBannerDismissed,
    skillBannerSubtitle,
    dismissSkillRecommendation,
    restoreIntentBanner,
    collapsedIntentModel,
    handleCategoryFilterChange,
    resetIntentUiForClearFilter,
  } = useExerciseSkillIntent({
    categories,
    categoriesResolved,
    setFilters,
    filtersRef,
    navigate,
    location,
    t,
    trackEvent,
    onIntentMatchedApplyLessonReset,
  });

  const [mascotMood, setMascotMood] = useState<
    "neutral" | "celebrate" | "encourage"
  >("neutral");
  const logError = useCallback(
    (...args) => {
      if (isDevelopment) {
        console.error(...args);
      }
    },
    [isDevelopment]
  );
  const pulseMascot = useCallback((nextMood: "celebrate" | "encourage") => {
    if (mascotTimeoutRef.current) {
      clearTimeout(mascotTimeoutRef.current);
    }
    mascotInteractionCountRef.current += 1;
    setMascotMood(nextMood);
    mascotTimeoutRef.current = setTimeout(() => {
      setMascotMood("neutral");
    }, 3500);
  }, []);

  const currentExercise = useMemo(
    () => exercises[currentExerciseIndex] || null,
    [exercises, currentExerciseIndex]
  );

  const skillIntentReceivedKeyRef = useRef<string | null>(null);
  const skillIntentOutcomeKeyRef = useRef<string | null>(null);
  const skillIntentEngagedRef = useRef(false);
  const cameFromDashboardSkillRef = useRef(false);
  const exercisesPageViewSentRef = useRef<string | null>(null);
  const exerciseStartedLoggedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dashboardEntrySurface = useMemo(() => {
    const hasSkillQuery = Boolean(
      new URLSearchParams(location.search).get("skill")?.trim()
    );
    if (intentReason === "quick_card_exercises") return "quick_card";
    if (intentReason === "weak_skill_practice") return "weak_skill_practice";
    if (intentReason === "weak_skill_click") return "weak_skill_card";
    if (hasSkillQuery) return "skill_query_only";
    return "organic";
  }, [intentReason, location.search]);

  useEffect(() => {
    if (targetSkillIntent.trim()) {
      cameFromDashboardSkillRef.current = true;
    }
  }, [targetSkillIntent]);

  useEffect(() => {
    skillIntentEngagedRef.current = false;
  }, [targetSkillIntent]);

  useEffect(() => {
    exerciseStartedLoggedRef.current = false;
  }, [location.key]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    const id = `${location.key}|${location.pathname}|${location.search}`;
    if (exercisesPageViewSentRef.current === id) return;
    exercisesPageViewSentRef.current = id;
    const skillInQuery =
      new URLSearchParams(location.search).get("skill") || null;
    trackEvent("exercises_page_view", {
      skill_in_query: skillInQuery,
      intent_source: intentSource,
      intent_reason: intentReason ?? null,
      from_dashboard: intentFromDashboard,
      dashboard_entry_surface: dashboardEntrySurface,
    });
  }, [
    isInitialized,
    isAuthenticated,
    location.key,
    location.pathname,
    location.search,
    intentSource,
    intentReason,
    intentFromDashboard,
    dashboardEntrySurface,
    trackEvent,
  ]);

  const hintFeature = entitlements?.features?.hints;
  const hintEnabled = hintFeature?.enabled ?? true;
  const hintRemaining = hintFeature?.remaining_today;
  const hintUnlimited = hintRemaining === null || hintRemaining === undefined;
  const hintDepleted = !hintUnlimited && hintRemaining <= 0;
  const soundEnabled = settings?.sound_enabled ?? true;
  const animationsEnabled = Boolean(settings?.animations_enabled ?? true);
  const hintCoinCost = 5;

  const validateExerciseList = useCallback((data: unknown[]) => {
    type ValidatedExercise = {
      id: number;
      question: unknown;
      type: string;
      exercise_data: Record<string, unknown>;
      [key: string]: unknown;
    };
    return data.filter((exercise): exercise is ValidatedExercise => {
      if (!exercise || typeof exercise !== "object") return false;
      const candidate = exercise as {
        id?: unknown;
        question?: unknown;
        type?: unknown;
        exercise_data?: unknown;
      };
      if (
        typeof candidate.id !== "number" ||
        !candidate.question ||
        typeof candidate.type !== "string" ||
        !candidate.exercise_data ||
        typeof candidate.exercise_data !== "object"
      ) {
        return false;
      }
      const exerciseData = candidate.exercise_data as Record<string, unknown>;
      return (
        (candidate.type === "multiple-choice" &&
          Array.isArray(exerciseData.options)) ||
        (candidate.type === "numeric" &&
          typeof exerciseData.expected_value !== "undefined") ||
        (candidate.type === "drag-and-drop" &&
          Array.isArray(exerciseData.items)) ||
        (candidate.type === "budget-allocation" &&
          Array.isArray(exerciseData.categories)) ||
        (candidate.type === "fill-in-table" &&
          (() => {
            const table = exerciseData.table as
              | { rows?: unknown; columns?: unknown }
              | undefined;
            return Array.isArray(table?.rows) && Array.isArray(table?.columns);
          })()) ||
        (candidate.type === "scenario-simulation" &&
          Array.isArray(exerciseData.choices))
      );
    });
  }, []);

  type FilterSnapshot = { type: string; category: string; difficulty: string };

  const isAbortLike = (err: unknown) => {
    if (!err || typeof err !== "object") return false;
    const e = err as { code?: string; name?: string };
    return (
      e.code === "ERR_CANCELED" ||
      e.name === "CanceledError" ||
      e.name === "AbortError"
    );
  };

  const hydrateProgressFromBackend = useCallback(
    async (exerciseList: Array<{ id: number }>) => {
      if (!exerciseList.length) {
        setProgress([]);
        setSavedAnswers({});
        return;
      }

      const loadViaSingleProgressEndpoints = async () => {
        const responses = await Promise.all(
          exerciseList.map((exercise) =>
            apiClient
              .get(`/exercises/progress/${exercise.id}/`, {
                skipGlobalErrorToast: true,
              })
              .then((res) => ({
                id: exercise.id,
                data: res.data,
              }))
              .catch(() => ({
                id: exercise.id,
                data: null,
              }))
          )
        );
        const nextSavedAnswers: Record<number, unknown> = {};
        const nextProgress = exerciseList.map((exercise) => {
          const item = responses.find((r) => r.id === exercise.id)?.data as {
            completed?: boolean;
            attempts?: number;
            user_answer?: unknown;
          } | null;
          if (!item) return undefined;
          const hasRealProgress =
            Boolean(item.completed) ||
            Number(item.attempts || 0) > 0 ||
            (item.user_answer !== null &&
              typeof item.user_answer !== "undefined");
          if (!hasRealProgress) return undefined;
          if (
            item.user_answer !== null &&
            typeof item.user_answer !== "undefined"
          ) {
            nextSavedAnswers[exercise.id] = item.user_answer;
          }
          return {
            exerciseId: exercise.id,
            correct: Boolean(item.completed),
            attempts: Number(item.attempts || 0),
            status: item.completed ? "completed" : "attempted",
            user_answer: item.user_answer,
          };
        });
        setSavedAnswers(nextSavedAnswers);
        setProgress(nextProgress as typeof progress);
      };

      if (!supportsProgressBatchRef.current) {
        await loadViaSingleProgressEndpoints();
        return;
      }
      try {
        const ids = exerciseList.map((e) => e.id).join(",");
        const response = await apiClient.get("/exercises/progress-batch/", {
          params: { ids },
          skipGlobalErrorToast: true,
        });
        let progressMap = response.data?.progress || {};
        if (!progressMap || typeof progressMap !== "object") {
          progressMap = {};
        }

        const nextSavedAnswers: Record<number, unknown> = {};
        const nextProgress = exerciseList.map((exercise) => {
          const item = progressMap[String(exercise.id)] as
            | {
                completed?: boolean;
                attempts?: number;
                user_answer?: unknown;
              }
            | undefined;
          if (!item) return undefined;
          const hasRealProgress =
            Boolean(item.completed) ||
            Number(item.attempts || 0) > 0 ||
            (item.user_answer !== null &&
              typeof item.user_answer !== "undefined");
          if (!hasRealProgress) return undefined;
          if (
            item.user_answer !== null &&
            typeof item.user_answer !== "undefined"
          ) {
            nextSavedAnswers[exercise.id] = item.user_answer;
          }
          return {
            exerciseId: exercise.id,
            correct: Boolean(item.completed),
            attempts: Number(item.attempts || 0),
            status: item.completed ? "completed" : "attempted",
            user_answer: item.user_answer,
          };
        });
        setSavedAnswers(nextSavedAnswers);
        setProgress(nextProgress as typeof progress);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 404) {
          try {
            supportsProgressBatchRef.current = false;
            try {
              sessionStorage.setItem(
                SUPPORTS_PROGRESS_BATCH_STORAGE_KEY,
                "false"
              );
            } catch {
              /* ignore */
            }
            await loadViaSingleProgressEndpoints();
            return;
          } catch (fallbackErr) {
            logError("Failed fallback hydrate exercise progress", fallbackErr);
          }
        }
        logError("Failed to hydrate exercise progress", err);
      }
    },
    [logError]
  );

  const fetchExercisesWithSnapshot = useCallback(
    async (
      snapshot: FilterSnapshot,
      options: {
        resetLessonSession?: boolean;
        fullPageLoading?: boolean;
      } = {}
    ) => {
      const { resetLessonSession = false, fullPageLoading = false } = options;
      exercisesAbortRef.current?.abort();
      const ac = new AbortController();
      exercisesAbortRef.current = ac;
      const gen = ++exercisesFetchGenerationRef.current;

      try {
        if (fullPageLoading) {
          setLoading(true);
        } else {
          setListRefreshing(true);
        }
        setError("");
        const params = new URLSearchParams();
        if (snapshot.type) params.append("type", snapshot.type);
        if (snapshot.category) params.append("category", snapshot.category);
        if (snapshot.difficulty)
          params.append("difficulty", snapshot.difficulty);

        const response = await apiClient.get("/exercises/", {
          params,
          signal: ac.signal,
        });
        if (gen !== exercisesFetchGenerationRef.current) return;

        const validatedExercises = validateExerciseList(response.data);

        setLessonExercises(validatedExercises);
        if (mode === "lesson") {
          setExercises(validatedExercises);
          await hydrateProgressFromBackend(validatedExercises);
          if (resetLessonSession) {
            setCurrentExerciseIndex(0);
            setShowCorrection(false);
            setUserAnswer(null);
            setSubmissionFeedback("");
            setExplanation("");
            setInlineHint("");
            setSessionCompleted(false);
          }
        }
        if (gen === exercisesFetchGenerationRef.current) {
          setLoading(false);
        }
      } catch (err) {
        if (isAbortLike(err)) {
          return;
        }
        if (gen !== exercisesFetchGenerationRef.current) return;
        setError(t("exercises.errors.loadFailed"));
        setLoading(false);
      } finally {
        if (gen === exercisesFetchGenerationRef.current) {
          setListRefreshing(false);
        }
      }
    },
    [hydrateProgressFromBackend, mode, t, validateExerciseList]
  );

  const fetchExercises = useCallback(async () => {
    const firstEver = !exercisesBootRef.current;
    if (firstEver) {
      exercisesBootRef.current = true;
    }
    await fetchExercisesWithSnapshot(filters, {
      fullPageLoading: firstEver,
    });
  }, [filters, fetchExercisesWithSnapshot]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.get("/exercises/categories/");
      setCategories(response.data);
    } catch (err) {
      logError("Failed to load categories:", err);
    } finally {
      setCategoriesResolved(true);
    }
  }, [logError]);

  const fetchReviewQueue = useCallback(async () => {
    try {
      const response = await apiClient.get("/review-queue/");
      setReviewQueue(response.data);
    } catch (err) {
      logError("Failed to load review queue", err);
    }
  }, [logError]);

  const startReviewMode = useCallback(async () => {
    if (!reviewQueue?.due?.length) {
      setMode("lesson");
      setExercises(lessonExercises);
      setCurrentExerciseIndex(0);
      return;
    }

    try {
      const details = await Promise.all(
        reviewQueue.due.map((item) =>
          apiClient.get(`/exercises/${item.exercise_id}/`)
        )
      );
      setMode("review");
      setExercises(details.map((d) => d.data));
      setCurrentExerciseIndex(0);
      setProgress([]);
      setUserAnswer(null);
      setSubmissionFeedback("");
      setExplanation("");
    } catch (err) {
      logError("Failed to load review exercises", err);
    }
  }, [lessonExercises, logError, reviewQueue]);

  const exitReviewMode = useCallback(() => {
    setMode("lesson");
    setExercises(lessonExercises);
    setCurrentExerciseIndex(0);
    setSubmissionFeedback("");
    setExplanation("");
    setProgress([]);
  }, [lessonExercises]);

  const goToRecommended = useCallback(async () => {
    try {
      const lastExercise = exercises[currentExerciseIndex];
      const response = await apiClient.post("/next/", {
        last_exercise_id: lastExercise?.id,
        last_correct: progress[currentExerciseIndex]?.correct,
      });

      if (response.data?.exercise_id) {
        const detail = await apiClient.get(
          `/exercises/${response.data.exercise_id}/`
        );
        setMode("lesson");
        setExercises([detail.data]);
        if (!lessonExercises.length) {
          setLessonExercises([detail.data]);
        }
        setCurrentExerciseIndex(0);
        setProgress([]);
        setSubmissionFeedback("");
        setExplanation("");
      }
    } catch (err) {
      logError("Failed to fetch next recommended exercise", err);
    }
  }, [
    currentExerciseIndex,
    exercises,
    logError,
    lessonExercises.length,
    progress,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      exercisesBootRef.current = false;
      setCategoriesResolved(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchCategories();
    fetchReviewQueue();
  }, [
    isInitialized,
    isAuthenticated,
    fetchCategories,
    fetchReviewQueue,
    navigate,
  ]);

  useEffect(() => {
    if (exercises.length > 0 && currentExerciseIndex >= exercises.length) {
      setCurrentExerciseIndex(Math.max(0, exercises.length - 1));
    }
  }, [exercises.length, currentExerciseIndex, exercises]);

  useEffect(() => {
    if (mode !== "lesson" || !exercises.length) return;
    const ids = exercises.map((e) => e.id);
    const idsKey = ids.join("|");
    const filterKey = `${filters.type}|${filters.category}|${filters.difficulty}`;
    const compositeKey = `${idsKey}@@${filterKey}`;
    if (lastLessonSessionRestoreKeyRef.current === compositeKey) return;
    lastLessonSessionRestoreKeyRef.current = compositeKey;

    try {
      const raw = sessionStorage.getItem(LESSON_SESSION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        parsed.mode === "lesson" &&
        parsed.filters &&
        parsed.filters.type === filters.type &&
        parsed.filters.category === filters.category &&
        parsed.filters.difficulty === filters.difficulty &&
        Array.isArray(parsed.ids) &&
        parsed.ids.length === ids.length &&
        parsed.ids.every((id: unknown, i: number) => id === ids[i])
      ) {
        const idx = typeof parsed.index === "number" ? parsed.index : 0;
        if (idx >= 0 && idx < ids.length) {
          setCurrentExerciseIndex(idx);
        }
      }
    } catch {
      /* ignore */
    }
  }, [mode, exercises, filters.type, filters.category, filters.difficulty]);

  useEffect(() => {
    if (mode !== "lesson" || !exercises.length) return;
    try {
      const payload = {
        mode: "lesson" as const,
        ids: exercises.map((e) => e.id),
        index: currentExerciseIndex,
        filters: {
          type: filters.type,
          category: filters.category,
          difficulty: filters.difficulty,
        },
      };
      sessionStorage.setItem(
        LESSON_SESSION_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      /* ignore */
    }
  }, [
    mode,
    exercises,
    currentExerciseIndex,
    filters.type,
    filters.category,
    filters.difficulty,
  ]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    if (!skillFetchReady) return;
    void fetchExercises();
  }, [isInitialized, isAuthenticated, fetchExercises, skillFetchReady]);

  useEffect(() => {
    return () => {
      exercisesFetchGenerationRef.current += 1;
      exercisesAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!targetSkillIntent || !skillFetchReady) return;
    const id = `${location.key}|recv|${targetSkillIntent}`;
    if (skillIntentReceivedKeyRef.current === id) return;
    skillIntentReceivedKeyRef.current = id;
    trackEvent("exercise_skill_intent_received", {
      skill: targetSkillIntent,
      source: intentSource,
      reason: intentReason ?? null,
      from_dashboard: intentFromDashboard,
    });
  }, [
    targetSkillIntent,
    skillFetchReady,
    intentSource,
    intentReason,
    intentFromDashboard,
    location.key,
    trackEvent,
  ]);

  const intentOutcomeStatus = intentResolution.status;
  const intentOutcomeCategory =
    intentResolution.status === "mapped" ? intentResolution.category : "";

  useEffect(() => {
    if (!skillFetchReady || loading || listRefreshing) return;
    if (!targetSkillIntent.trim()) return;
    if (intentOutcomeStatus === "idle") return;
    const id = `${location.key}|out|${targetSkillIntent}|${intentOutcomeStatus}|${intentOutcomeCategory}|${exercises.length}`;
    if (skillIntentOutcomeKeyRef.current === id) return;
    skillIntentOutcomeKeyRef.current = id;
    if (intentOutcomeStatus === "unmapped") {
      trackEvent("exercise_skill_intent_unmapped", {
        skill: targetSkillIntent,
        result_count: exercises.length,
      });
    } else {
      trackEvent("exercise_skill_intent_mapped", {
        skill: targetSkillIntent,
        category: intentOutcomeCategory,
        result_count: exercises.length,
        mapped_zero_results: exercises.length === 0,
      });
      if (exercises.length === 0) {
        trackEvent("exercise_skill_intent_mapped_zero", {
          skill: targetSkillIntent,
          category: intentOutcomeCategory,
        });
      }
    }
  }, [
    skillFetchReady,
    loading,
    listRefreshing,
    targetSkillIntent,
    intentOutcomeStatus,
    intentOutcomeCategory,
    exercises.length,
    location.key,
    trackEvent,
  ]);

  const clearSkillFocus = useCallback(() => {
    if (
      targetSkillIntent ||
      new URLSearchParams(location.search).get("skill")
    ) {
      trackEvent("exercise_skill_intent_cleared", { action: "clear_filter" });
    }
    resetIntentUiForClearFilter();
    try {
      sessionStorage.removeItem(LESSON_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const next = { ...filtersRef.current, category: "" };
    setFilters(next);
    navigate({ pathname: "/exercises" }, { replace: true, state: {} });
    setCurrentExerciseIndex(0);
    setProgress([]);
    setShowCorrection(false);
    setUserAnswer(null);
    setSubmissionFeedback("");
    setExplanation("");
    setInlineHint("");
    setSavedAnswers({});
    setSessionCompleted(false);
  }, [
    navigate,
    targetSkillIntent,
    location.search,
    trackEvent,
    resetIntentUiForClearFilter,
  ]);

  const initializeAnswer = (exercise) => {
    if (!exercise) return null;

    switch (exercise.type) {
      case "drag-and-drop":
        return exercise.exercise_data.items.map((_, index) => index);
      case "numeric":
        return "";
      case "budget-allocation":
        return exercise.exercise_data.categories.reduce((acc, category) => {
          acc[category] = 0;
          return acc;
        }, {});
      case "fill-in-table": {
        const columns = exercise.exercise_data?.table?.columns || [];
        const rows = exercise.exercise_data?.table?.rows || [];
        return rows.reduce((acc, row) => {
          acc[row.id] = Array.from({ length: columns.length }).map(() => "");
          return acc;
        }, {});
      }
      case "scenario-simulation":
        return null;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (currentExercise) {
      const serverSavedAnswer =
        progress[currentExerciseIndex] &&
        typeof progress[currentExerciseIndex] === "object"
          ? (progress[currentExerciseIndex] as { user_answer?: unknown })
              .user_answer
          : undefined;
      const cachedAnswer = savedAnswers[currentExercise.id];
      setUserAnswer(
        typeof cachedAnswer !== "undefined"
          ? cachedAnswer
          : typeof serverSavedAnswer !== "undefined" &&
              serverSavedAnswer !== null
            ? serverSavedAnswer
            : initializeAnswer(currentExercise)
      );
      setHintIndex(0);
      setHintError("");
      setSubmissionFeedback("");
      setScratchpad("");
      setInlineHint("");
    }
  }, [currentExercise, currentExerciseIndex, progress, savedAnswers]);

  useEffect(() => {
    if (isTimedMode) {
      const baseTime = 300;
      const timePerExercise = 30;
      const totalTime = baseTime + exercises.length * timePerExercise;
      setTimeRemaining(totalTime);

      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 0) {
            clearInterval(timerRef.current);
            setShowStats(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimedMode, exercises.length]);

  useEffect(() => {
    if (sessionCompleted) {
      setShowStats(true);
    }
  }, [sessionCompleted]);

  useEffect(() => {
    return () => {
      if (inlineHintTimeoutRef.current) {
        clearTimeout(inlineHintTimeoutRef.current);
      }
      if (skillInsightTimeoutRef.current) {
        clearTimeout(skillInsightTimeoutRef.current);
      }
      if (mascotTimeoutRef.current) {
        clearTimeout(mascotTimeoutRef.current);
      }
    };
  }, []);

  const handleRetry = async () => {
    if (!currentExercise) return;
    setIsRetrying(true);
    try {
      await apiClient.post("/exercises/reset/", {
        exercise_id: currentExercise.id,
      });
    } catch (err) {
      logError("Failed to reset exercise progress", err);
    }
    const updatedProgress = [...progress];
    updatedProgress[currentExerciseIndex] = {
      exerciseId: currentExercise.id,
      correct: false,
      attempts: 0,
      status: "not_started",
    };
    setProgress(updatedProgress);

    setUserAnswer(
      savedAnswers[currentExercise.id] || initializeAnswer(currentExercise)
    );

    setShowCorrection(false);
    setExplanation("");
    setSubmissionFeedback("");
    setInlineHint("");
    setIsRetrying(false);
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      if (!currentExercise) return;

      if (
        userAnswer === null ||
        userAnswer === undefined ||
        (typeof userAnswer === "string" && userAnswer.trim() === "") ||
        (Array.isArray(userAnswer) && userAnswer.length === 0) ||
        (typeof userAnswer === "object" &&
          !Array.isArray(userAnswer) &&
          Object.values(userAnswer).every((value) => {
            if (Array.isArray(value)) {
              return value.every(
                (cell) => cell === null || String(cell).trim() === ""
              );
            }
            return value === null || String(value).trim() === "";
          }))
      ) {
        setSubmissionFeedback(t("exercises.errors.submitAnswer"));
        setShowCorrection(true);
        return;
      }

      if (!exerciseStartedLoggedRef.current) {
        exerciseStartedLoggedRef.current = true;
        trackEvent("exercise_started", {
          exercise_id: currentExercise.id,
          exercise_type: currentExercise.type,
          category: currentExercise.category ?? null,
          from_dashboard_skill_flow: cameFromDashboardSkillRef.current,
        });
      }

      const previousProgress = progress[currentExerciseIndex] || {};
      const wasFreshAttempt = !previousProgress.attempts;

      setSavedAnswers((prev) => ({
        ...prev,
        [currentExercise.id]: userAnswer,
      }));

      const response = await apiClient.post(
        `/exercises/${currentExercise.id}/submit/`,
        { user_answer: userAnswer, hints_used: hintIndex }
      );

      const updated = [...progress];
      updated[currentExerciseIndex] = {
        exerciseId: currentExercise.id,
        correct: response.data.correct,
        attempts: response.data.attempts,
        status: response.data.correct ? "completed" : "attempted",
        user_answer: userAnswer,
      };

      setProgress(updated);
      if (cameFromDashboardSkillRef.current && !skillIntentEngagedRef.current) {
        skillIntentEngagedRef.current = true;
        trackEvent("exercise_skill_intent_engaged", {
          exercise_id: currentExercise.id,
        });
      }
      setExplanation(response.data.explanation || "");
      setSubmissionFeedback(response.data.feedback || "");
      playFeedbackChime({
        enabled: Boolean(soundEnabled ?? true),
        correct: Boolean(response.data.correct),
      });
      pulseMascot(response.data.correct ? "celebrate" : "encourage");
      setXpTotal((prev) => prev + (response.data.xp_delta || 0));
      if (typeof response.data.coins_delta === "number") {
        setCoinsEarned((prev) => prev + response.data.coins_delta);
      }
      fetchReviewQueue();
      setShowCorrection(true);

      const inlineMessage =
        response.data.explanation ||
        (response.data.correct
          ? t("exercises.inline.correct")
          : t("exercises.inline.incorrect"));
      setInlineHint(inlineMessage);
      if (inlineHintTimeoutRef.current) {
        clearTimeout(inlineHintTimeoutRef.current);
      }
      inlineHintTimeoutRef.current = setTimeout(() => {
        setInlineHint("");
      }, 4500);

      const projectedFirstTry =
        response.data.correct && wasFreshAttempt
          ? firstTryCorrect + 1
          : firstTryCorrect;

      if (response.data.correct && wasFreshAttempt) {
        setFirstTryCorrect((prev) => prev + 1);
      }

      if (response.data.correct) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        setStreakMultiplier(newStreak >= 3 ? 1.2 : 1);
      } else {
        setStreak(0);
        setStreakMultiplier(1);
      }

      const skill = currentExercise.category || t("exercises.skillFallback");
      const before = skillProficiency[skill] || 0;
      const after = response.data.proficiency ?? before;
      const skillDelta = after - before;
      setSkillProficiency((prev) => ({ ...prev, [skill]: after }));
      if (skillDelta > 0) {
        setSkillGains((prev) => ({
          ...prev,
          [skill]: (prev[skill] || 0) + skillDelta,
        }));
      }

      const skillInsightMessage = response.data.first_unlock
        ? t("exercises.skillInsight.firstUnlock", { skill })
        : skillDelta > 0
          ? t("exercises.skillInsight.levelUp", {
              skill,
              level:
                response.data.level_label ||
                t("exercises.skillInsight.building"),
            })
          : response.data.correct
            ? t("exercises.skillInsight.keepBuilding", { skill })
            : "";
      if (skillInsightMessage) {
        setRecentSkillInsight(skillInsightMessage);
        if (skillInsightTimeoutRef.current) {
          clearTimeout(skillInsightTimeoutRef.current);
        }
        skillInsightTimeoutRef.current = setTimeout(() => {
          setRecentSkillInsight("");
        }, 4500);
      }

      const correctAnswers = updated.filter((p) => p.correct).length;
      const totalAttempts = updated.reduce((sum, p) => sum + p.attempts, 0);
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

      setStats({
        totalCompleted: correctAnswers,
        totalExercises: exercises.length,
        averageAccuracy: exercises.length
          ? (correctAnswers / exercises.length) * 100
          : 0,
        averageAttempts: exercises.length
          ? totalAttempts / exercises.length
          : 0,
        totalTimeSpent: timeSpent,
        firstTryAccuracy: exercises.length
          ? (projectedFirstTry / exercises.length) * 100
          : 0,
      });

      if (correctAnswers === exercises.length) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setShowStats(true);
      }
    } catch (err: unknown) {
      const status = (
        err as { response?: { status?: number; data?: { error?: string } } }
      )?.response?.status;
      const detail = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      if (status === 429 && typeof detail === "string" && detail.trim()) {
        setError(detail);
      } else {
        setError(t("exercises.errors.submissionFailed"));
      }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const openTutor = useCallback(() => {
    if (!currentExercise) return;
    const context = `Question: ${currentExercise.question}\nYour answer: ${
      userAnswer ?? "No answer"
    }\nExplanation: ${explanation || submissionFeedback || "N/A"}`;
    window.dispatchEvent(
      new CustomEvent("monevo:tutor", { detail: { context } })
    );
  }, [currentExercise, explanation, submissionFeedback, userAnswer]);

  const revealNextHint = () => {
    const currentExercise = exercises[currentExerciseIndex];
    const hints = currentExercise?.exercise_data?.hints || [];
    if (!hintEnabled) {
      setHintError(t("exercises.hints.unavailable"));
      return;
    }
    if (hintDepleted) {
      setHintError(t("exercises.hints.depleted"));
      return;
    }
    if (hintIndex < hints.length) {
      setHintIndex((prev) => prev + 1);
    }
  };

  const evaluateCalculator = () => {
    if (!calculatorValue.trim()) return;
    const sanitized = calculatorValue.replace(/[^0-9+\-*/().%\s]/g, "");
    const normalized = sanitized.replace(/%/g, "*0.01");

    const tokens = [];
    let current = "";
    const flushNumber = () => {
      if (!current) return;
      if (!Number.isFinite(Number(current))) {
        throw new Error("Invalid number");
      }
      tokens.push({ type: "number", value: Number(current) });
      current = "";
    };

    for (let i = 0; i < normalized.length; i += 1) {
      const ch = normalized[i];
      if ((ch >= "0" && ch <= "9") || ch === ".") {
        current += ch;
        continue;
      }
      if (ch === " " || ch === "\t" || ch === "\n") {
        continue;
      }
      flushNumber();
      if ("+-*/()".includes(ch)) {
        tokens.push({ type: "op", value: ch });
        continue;
      }
      throw new Error("Invalid token");
    }
    flushNumber();

    const output = [];
    const ops = [];
    const precedence = { "u-": 3, "*": 2, "/": 2, "+": 1, "-": 1 };
    const rightAssoc = { "u-": true };

    let prevToken = null;
    tokens.forEach((token) => {
      if (token.type === "number") {
        output.push(token);
        prevToken = token;
        return;
      }

      if (token.value === "(") {
        ops.push(token);
        prevToken = token;
        return;
      }

      if (token.value === ")") {
        while (ops.length && ops[ops.length - 1].value !== "(") {
          output.push(ops.pop());
        }
        if (!ops.length) throw new Error("Mismatched parentheses");
        ops.pop();
        prevToken = token;
        return;
      }

      let opToken = token;
      const isUnary =
        opToken.value === "-" &&
        (!prevToken || (prevToken.type === "op" && prevToken.value !== ")"));
      if (isUnary) {
        opToken = { type: "op", value: "u-" };
      }

      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.type !== "op" || top.value === "(") break;
        const precTop = precedence[top.value];
        const precCurr = precedence[opToken.value];
        if (
          (rightAssoc[opToken.value] && precCurr < precTop) ||
          (!rightAssoc[opToken.value] && precCurr <= precTop)
        ) {
          output.push(ops.pop());
          continue;
        }
        break;
      }
      ops.push(opToken);
      prevToken = opToken;
    });

    while (ops.length) {
      const op = ops.pop();
      if (op.value === "(") throw new Error("Mismatched parentheses");
      output.push(op);
    }

    const stack = [];
    output.forEach((token) => {
      if (token.type === "number") {
        stack.push(token.value);
        return;
      }
      if (token.value === "u-") {
        const value = stack.pop();
        if (value === undefined) throw new Error("Invalid expression");
        stack.push(-value);
        return;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined)
        throw new Error("Invalid expression");
      switch (token.value) {
        case "+":
          stack.push(a + b);
          break;
        case "-":
          stack.push(a - b);
          break;
        case "*":
          stack.push(a * b);
          break;
        case "/":
          stack.push(a / b);
          break;
        default:
          throw new Error("Invalid operator");
      }
    });

    const result = stack.pop();
    if (stack.length || !Number.isFinite(result)) {
      setCalculatorValue(t("exercises.calculator.checkExpression"));
      return;
    }
    setCalculatorValue(String(result));
  };

  const appendCalculator = (chunk: string) => {
    setCalculatorValue((prev) => `${prev}${chunk}`);
  };

  const handleNext = () => {
    setShowCorrection(false);
    setExplanation("");
    setSubmissionFeedback("");
    setInlineHint("");
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
    } else {
      setSessionCompleted(true);
      fetchReviewQueue();
      if (mode === "review") {
        setExercises([]);
      }
    }
  };

  const renderExercise = () => {
    const exercise = currentExercise;
    if (!exercise || !exercise.exercise_data) {
      return (
        <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]">
          {t("exercises.errors.invalidFormat")}
        </div>
      );
    }

    const hasResult = Boolean(showCorrection && progress[currentExerciseIndex]);
    const isAnswerCorrect = Boolean(progress[currentExerciseIndex]?.correct);

    const difficultyKey =
      exercise.difficulty === "beginner" ||
      exercise.difficulty === "intermediate" ||
      exercise.difficulty === "advanced"
        ? exercise.difficulty
        : null;

    const metaBadges = (
      <div className="mb-2 flex flex-wrap gap-2">
        {difficultyKey ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-100">
            {t(`exercises.filters.${difficultyKey}`)}
          </span>
        ) : null}
        {exercise.category ? (
          <span className="inline-flex items-center rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
            {exercise.category}
          </span>
        ) : null}
      </div>
    );

    switch (exercise.type) {
      case "multiple-choice": {
        const correctIndexRaw = exercise.correct_answer;
        const correctOptionIndex =
          typeof correctIndexRaw === "number"
            ? correctIndexRaw
            : Number.isFinite(Number(correctIndexRaw))
              ? Number(correctIndexRaw)
              : null;
        return (
          <div className="space-y-4">
            {metaBadges}
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            <div className="grid gap-3">
              {exercise.exercise_data.options.map((option, index) => {
                const id = `exercise-option-${index}`;
                let frameClass =
                  "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:border-[color:var(--accent,#ffd700)]/40 ";
                if (hasResult) {
                  if (
                    correctOptionIndex !== null &&
                    index === correctOptionIndex
                  ) {
                    frameClass +=
                      "border-emerald-500/60 bg-emerald-500/10 text-emerald-700";
                  } else if (userAnswer === index) {
                    frameClass += isAnswerCorrect
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                      : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]";
                  } else {
                    frameClass +=
                      "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)]";
                  }
                } else if (userAnswer === index) {
                  frameClass +=
                    "border-[color:var(--accent,#ffd700)] bg-[color:var(--accent,#ffd700)]/10 text-[color:var(--accent,#ffd700)]";
                } else {
                  frameClass +=
                    "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)]";
                }
                return (
                  <label key={id} htmlFor={id} className={frameClass}>
                    <input
                      id={id}
                      type="radio"
                      name="exercise-options"
                      checked={userAnswer === index}
                      onChange={() => setUserAnswer(index)}
                      className="h-4 w-4 border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      }

      case "drag-and-drop":
        if (!Array.isArray(userAnswer)) {
          return (
            <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]">
              {t("exercises.errors.invalidDragDrop")}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            {metaBadges}
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            <div className="flex flex-wrap gap-3">
              {userAnswer.map((itemIndex, index) => {
                const item = exercise.exercise_data.items[itemIndex];
                const correctOrder = Array.isArray(exercise.correct_answer)
                  ? exercise.correct_answer
                  : null;
                const isCorrectSlot =
                  hasResult && correctOrder
                    ? correctOrder[index] === itemIndex
                    : null;
                return (
                  <div
                    key={`${item}-${index}`}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="text-xs font-semibold tabular-nums text-[color:var(--muted-text,#6b7280)]">
                      {t("exercises.drag.slot", { n: index + 1 })}
                    </span>
                    <div
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", String(index))
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "ArrowLeft" ||
                          event.key === "ArrowUp"
                        ) {
                          event.preventDefault();
                          if (index === 0) return;
                          const newOrder = [...userAnswer];
                          [newOrder[index - 1], newOrder[index]] = [
                            newOrder[index],
                            newOrder[index - 1],
                          ];
                          setUserAnswer(newOrder);
                        }
                        if (
                          event.key === "ArrowRight" ||
                          event.key === "ArrowDown"
                        ) {
                          event.preventDefault();
                          if (index === userAnswer.length - 1) return;
                          const newOrder = [...userAnswer];
                          [newOrder[index + 1], newOrder[index]] = [
                            newOrder[index],
                            newOrder[index + 1],
                          ];
                          setUserAnswer(newOrder);
                        }
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        const fromIndex = parseInt(
                          event.dataTransfer.getData("text/plain"),
                          10
                        );
                        const newOrder = [...userAnswer];
                        [newOrder[fromIndex], newOrder[index]] = [
                          newOrder[index],
                          newOrder[fromIndex],
                        ];
                        setUserAnswer(newOrder);
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${t("exercises.drag.slot", { n: index + 1 })}: ${item}`}
                      className={`flex min-h-[72px] min-w-[160px] cursor-move items-center justify-center rounded-2xl border bg-[color:var(--card-bg,#ffffff)] px-4 py-3 text-sm font-medium text-[color:var(--text-color,#111827)] shadow-inner transition hover:border-[color:var(--accent,#ffd700)]/40 ${
                        hasResult && isCorrectSlot !== null
                          ? isCorrectSlot
                            ? "border-emerald-500/60 bg-emerald-500/10"
                            : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10"
                          : "border-[color:var(--border-color,#d1d5db)]"
                      }`}
                    >
                      {item}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "numeric": {
        const expectedRaw =
          exercise.correct_answer ?? exercise.exercise_data?.expected_value;
        const toleranceRaw = exercise.exercise_data?.tolerance;
        const showNumericReveal =
          hasResult &&
          !isAnswerCorrect &&
          expectedRaw !== undefined &&
          expectedRaw !== null;
        return (
          <div className="space-y-4">
            {metaBadges}
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            {exercise.exercise_data?.prompt && (
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {exercise.exercise_data.prompt}
              </p>
            )}
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="text"
                value={userAnswer ?? ""}
                onChange={(event) => setUserAnswer(event.target.value)}
                placeholder={
                  exercise.exercise_data?.placeholder ||
                  t("exercises.inputs.numberPlaceholder")
                }
                className={`w-full rounded-xl border bg-[color:var(--input-bg,#f9fafb)] px-3 py-3 text-base text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30 ${
                  hasResult
                    ? isAnswerCorrect
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10"
                    : "border-[color:var(--border-color,#d1d5db)]"
                }`}
              />
              {exercise.exercise_data?.unit && (
                <span className="rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)]">
                  {exercise.exercise_data.unit}
                </span>
              )}
            </div>
            {showNumericReveal && (
              <p className="text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                {toleranceRaw !== undefined && toleranceRaw !== null
                  ? t("exercises.numeric.expectedWithTolerance", {
                      value: formatNumber(Number(expectedRaw), locale, {
                        maximumFractionDigits: 8,
                      }),
                      tolerance: formatNumber(Number(toleranceRaw), locale, {
                        maximumFractionDigits: 6,
                      }),
                    })
                  : t("exercises.numeric.expectedValue", {
                      value: formatNumber(Number(expectedRaw), locale, {
                        maximumFractionDigits: 8,
                      }),
                    })}
              </p>
            )}
            {exercise.exercise_data?.validation && (
              <div className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-3 text-sm text-[color:var(--muted-text,#6b7280)]">
                {exercise.exercise_data.validation}
              </div>
            )}
          </div>
        );
      }

      case "budget-allocation":
        return (
          <div className="space-y-4">
            {metaBadges}
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {exercise.exercise_data.categories.map((category, index) => (
                <label
                  key={`${category}-${index}`}
                  className={`flex flex-col gap-2 rounded-2xl border px-4 py-4 ${
                    hasResult
                      ? isAnswerCorrect
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)]"
                  }`}
                >
                  <span className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {category}
                  </span>
                  <input
                    type="number"
                    value={userAnswer[category] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setUserAnswer((prev) => ({
                        ...prev,
                        [category]:
                          value === ""
                            ? ""
                            : Math.max(0, parseFloat(value) || 0),
                      }));
                    }}
                    className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] backdrop-blur-sm px-3 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                  />
                </label>
              ))}
            </div>
          </div>
        );

      case "fill-in-table": {
        const columns = exercise.exercise_data?.table?.columns || [];
        const rows = exercise.exercise_data?.table?.rows || [];
        const correctAnswer = exercise.correct_answer || {};
        return (
          <div className="space-y-4">
            {metaBadges}
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-2 text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                      {t("exercises.table.row")}
                    </th>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 font-semibold text-[color:var(--accent,#111827)]">
                        {row.label ||
                          t("exercises.table.rowWithId", {
                            id: row.id,
                          })}
                      </td>
                      {columns.map((column, colIndex) => {
                        const value = userAnswer?.[row.id]?.[colIndex] ?? "";
                        const expected =
                          correctAnswer?.[row.id]?.[colIndex] ?? "";
                        const isCellCorrect = hasResult
                          ? String(value).trim().toLowerCase() ===
                            String(expected).trim().toLowerCase()
                          : null;
                        return (
                          <td key={`${row.id}-${column}`}>
                            <input
                              type="text"
                              value={value}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setUserAnswer((prev) => {
                                  const next = { ...(prev || {}) };
                                  const rowValues = [
                                    ...(next[row.id] ||
                                      Array(columns.length).fill("")),
                                  ];
                                  rowValues[colIndex] = nextValue;
                                  next[row.id] = rowValues;
                                  return next;
                                });
                              }}
                              aria-label={`${row.label || t("exercises.table.row")} ${column}`}
                              className={`w-full rounded-xl border px-3 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30 ${
                                hasResult
                                  ? isCellCorrect
                                    ? "border-emerald-500/60 bg-emerald-500/10"
                                    : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10"
                                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)]"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case "scenario-simulation": {
        const choices = exercise.exercise_data?.choices || [];
        const selectedChoice = choices.find(
          (choice) => choice.id === userAnswer
        );
        const correctChoiceId = exercise.correct_answer;
        return (
          <div className="space-y-4">
            {metaBadges}
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            {exercise.exercise_data?.scenario && (
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {exercise.exercise_data.scenario}
              </p>
            )}
            <div
              className="rounded-2xl border border-dashed border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)]"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const choiceId = event.dataTransfer.getData("text/plain");
                if (!choiceId) return;
                const parsed =
                  Number.isNaN(Number(choiceId)) || choiceId.trim() === ""
                    ? choiceId
                    : Number(choiceId);
                setUserAnswer(parsed);
              }}
            >
              <span className="font-semibold text-[color:var(--accent,#111827)]">
                {t("exercises.scenario.actionSlot")}
              </span>{" "}
              {selectedChoice?.label || t("exercises.scenario.dragHint")}
            </div>
            <div className="grid gap-3">
              {choices.map((choice, index) => {
                const isSelected = userAnswer === choice.id;
                const isCorrectChoice =
                  hasResult && choice.id === correctChoiceId;
                let choiceFrame =
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 ";
                if (hasResult) {
                  if (isCorrectChoice) {
                    choiceFrame +=
                      "border-emerald-500/60 bg-emerald-500/10 text-emerald-700";
                  } else if (isSelected) {
                    choiceFrame +=
                      "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]";
                  } else {
                    choiceFrame +=
                      "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)]";
                  }
                } else if (isSelected) {
                  choiceFrame +=
                    "border-[color:var(--accent,#ffd700)] bg-[color:var(--accent,#ffd700)]/10 text-[color:var(--accent,#ffd700)]";
                } else {
                  choiceFrame +=
                    "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)]";
                }
                return (
                  <button
                    key={`${choice.id}-${index}`}
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "text/plain",
                        String(choice.id)
                      )
                    }
                    onClick={() => setUserAnswer(choice.id)}
                    className={choiceFrame}
                  >
                    <span>{choice.label}</span>
                    {isSelected && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#ffd700)]">
                        {t("exercises.scenario.selected")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]">
            {t("exercises.errors.unsupportedType")}
          </div>
        );
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const applyingSkillFocus =
    Boolean(targetSkillIntent.trim()) && !skillFetchReady && !error;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <div className="flex items-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--accent,#ffd700)] border-t-transparent" />
          {applyingSkillFocus
            ? t("exercises.skillIntent.applyingFocus")
            : t("exercises.loading")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <GlassCard
          padding="lg"
          className="w-full max-w-lg border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-center text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/20"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchExercises}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
          >
            {t("exercises.retry")}
          </button>
        </GlassCard>
      </div>
    );
  }

  const progressPercent = exercises.length
    ? Math.round(((currentExerciseIndex + 1) / exercises.length) * 100)
    : 0;
  const currentLearnMoreUrl =
    currentExercise?.exercise_data?.learn_more_url ||
    currentExercise?.exercise_data?.learn_more_link ||
    "";

  return (
    <div className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            {t("exercises.header.title")}
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("exercises.header.subtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)] lg:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent,#ffd700)]/30 bg-[color:var(--accent,#ffd700)]/10 px-3 py-1 font-semibold text-[color:var(--accent,#ffd700)]">
              {t("exercises.reviewQueue.title")}
              <span className="rounded-full bg-[color:var(--card-bg,#ffffff)]/80 px-2 py-0.5 text-[color:var(--accent,#ffd700)]">
                {t("exercises.reviewQueue.due", {
                  count: reviewQueue.count || 0,
                })}
              </span>
            </span>
            {reviewQueue.due?.length > 0 && (
              <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
                {t("exercises.reviewQueue.nextUp", {
                  skill: reviewQueue.due[0].skill,
                  question: reviewQueue.due[0].question,
                })}
              </span>
            )}
            <button
              type="button"
              onClick={startReviewMode}
              disabled={!reviewQueue?.count}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 ${
                reviewQueue?.count
                  ? "border border-[color:var(--accent,#ffd700)]/40 bg-[color:var(--card-bg,#ffffff)] text-[color:var(--accent,#ffd700)] hover:border-[color:var(--accent,#ffd700)]/60"
                  : "cursor-not-allowed border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--muted-text,#6b7280)]"
              }`}
            >
              {t("exercises.reviewQueue.start")}
            </button>
          </div>
        </header>

        {mode === "review" && exercises.length === 0 && (
          <GlassCard
            padding="lg"
            className="border-[color:var(--accent,#ffd700)]/30 bg-white"
          >
            <div className="flex flex-col gap-3 text-center">
              <p className="text-base font-semibold text-[color:var(--accent,#111827)]">
                {t("exercises.reviewQueue.emptyTitle")}
              </p>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {t("exercises.reviewQueue.emptySubtitle")}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={exitReviewMode}
                  className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--accent,#ffd700)]/50"
                >
                  {t("exercises.reviewQueue.backToLesson")}
                </button>
                <button
                  type="button"
                  onClick={fetchExercises}
                  className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30"
                >
                  {t("exercises.reviewQueue.refresh")}
                </button>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <GlassCard padding="lg" className="relative w-full lg:flex-1">
            {listRefreshing && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-[color:var(--card-bg,#ffffff)]/75 backdrop-blur-sm"
                aria-busy="true"
                aria-live="polite"
              >
                <div className="flex flex-col items-center gap-2 px-4 text-sm text-[color:var(--muted-text,#6b7280)]">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--primary,#1d5330)] border-t-transparent" />
                  {t("exercises.refreshing")}
                </div>
              </div>
            )}
            {skillIntentBanner ? (
              <ExerciseIntentBanner
                model={skillIntentBanner}
                contextSubtitle={
                  intentFromDashboard ? skillBannerSubtitle : undefined
                }
                dismissed={skillBannerDismissed}
                showClearFilter={
                  skillIntentBanner.kind === "applied" &&
                  Boolean(filters.category)
                }
                onClearFilter={clearSkillFocus}
                onDismissRecommendation={dismissSkillRecommendation}
                onChangeCategory={() => setFiltersExpanded(true)}
              />
            ) : null}
            {!skillIntentBanner && collapsedIntentModel ? (
              <div
                className="mb-4 flex flex-col gap-2 rounded-xl border border-[color:var(--accent,#ffd700)]/30 bg-[color:var(--accent,#ffd700)]/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                role="status"
              >
                <p className="text-sm text-[color:var(--text-color,#111827)]">
                  {collapsedIntentModel.kind === "applied"
                    ? t("exercises.skillIntent.reminderShortApplied", {
                        skill: collapsedIntentModel.skill,
                        category: collapsedIntentModel.category,
                      })
                    : t("exercises.skillIntent.reminderShortUnmapped", {
                        skill: collapsedIntentModel.skill,
                      })}
                </p>
                <button
                  type="button"
                  onClick={restoreIntentBanner}
                  className="shrink-0 rounded-full border border-[color:var(--accent,#ffd700)]/50 bg-[color:var(--card-bg,#ffffff)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent,#ffd700)] transition hover:bg-[color:var(--accent,#ffd700)]/15"
                >
                  {t("exercises.skillIntent.restoreBanner")}
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setFiltersExpanded((open) => !open)}
              className="mb-3 flex w-full items-center justify-between rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/80 px-4 py-3 text-left text-sm font-semibold text-[color:var(--text-color,#111827)] lg:hidden"
              aria-expanded={filtersExpanded}
            >
              {filtersExpanded
                ? t("exercises.filters.toggleHide")
                : t("exercises.filters.toggleShow")}
              <span
                className={`text-[color:var(--muted-text,#6b7280)] transition-transform ${filtersExpanded ? "rotate-180" : ""}`}
                aria-hidden
              >
                ▼
              </span>
            </button>
            <div
              className={`grid gap-4 border-b border-white/20 pb-6 lg:grid-cols-3 ${filtersExpanded ? "" : "max-lg:hidden"}`}
            >
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {t("exercises.filters.type")}
                </label>
                <select
                  value={filters.type}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                >
                  <option value="">{t("exercises.filters.allTypes")}</option>
                  <option value="multiple-choice">
                    {t("exercises.filters.multipleChoice")}
                  </option>
                  <option value="numeric">
                    {t("exercises.filters.numeric")}
                  </option>
                  <option value="drag-and-drop">
                    {t("exercises.filters.dragDrop")}
                  </option>
                  <option value="budget-allocation">
                    {t("exercises.filters.budget")}
                  </option>
                  <option value="fill-in-table">
                    {t("exercises.filters.fillTable")}
                  </option>
                  <option value="scenario-simulation">
                    {t("exercises.filters.scenario")}
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {t("exercises.filters.category")}
                </label>
                <select
                  value={filters.category}
                  onChange={(event) =>
                    handleCategoryFilterChange(event.target.value)
                  }
                  className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                >
                  <option value="">
                    {t("exercises.filters.allCategories")}
                  </option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  {t("exercises.filters.difficulty")}
                </label>
                <select
                  value={filters.difficulty}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      difficulty: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                >
                  <option value="">
                    {t("exercises.filters.allDifficulties")}
                  </option>
                  <option value="beginner">
                    {t("exercises.filters.beginner")}
                  </option>
                  <option value="intermediate">
                    {t("exercises.filters.intermediate")}
                  </option>
                  <option value="advanced">
                    {t("exercises.filters.advanced")}
                  </option>
                </select>
              </div>
            </div>

            {mode === "lesson" && exercises.length === 0 && !listRefreshing ? (
              intentResolution.status === "mapped" &&
              filters.category === intentResolution.category ? (
                <ExerciseIntentLessonEmpty
                  variant="mapped_zero"
                  category={intentResolution.category}
                  onClearFilter={clearSkillFocus}
                  onOpenFilters={() => setFiltersExpanded(true)}
                />
              ) : intentResolution.status === "unmapped" ? (
                <ExerciseIntentLessonEmpty
                  variant="unmapped"
                  skill={intentResolution.skill}
                  onViewAllExercises={clearSkillFocus}
                  onOpenFilters={() => setFiltersExpanded(true)}
                />
              ) : (
                <ExerciseIntentLessonEmpty
                  variant="generic_filtered"
                  onClearFilter={filters.category ? clearSkillFocus : undefined}
                />
              )
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-white/20 py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                      {t("exercises.progress.label", {
                        current: currentExerciseIndex + 1,
                        total: Math.max(exercises.length, 1),
                      })}
                    </p>
                    <div className="h-2 w-full rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                      <div
                        className="h-2 rounded-full bg-[color:var(--primary,#1d5330)] transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <label className="flex shrink-0 items-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)]">
                    <span>{t("exercises.timedMode")}</span>
                    <div className="relative inline-flex h-6 w-11 items-center">
                      <input
                        type="checkbox"
                        checked={isTimedMode}
                        onChange={(event) =>
                          setIsTimedMode(event.target.checked)
                        }
                        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                      <span className="absolute inset-0 rounded-full bg-[color:var(--border-color,#d1d5db)] transition peer-checked:bg-[color:var(--accent,#ffd700)]" />
                      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                    </div>
                    {isTimedMode && (
                      <span className="text-xs font-semibold text-[color:var(--accent,#ffd700)]">
                        {formatTime(timeRemaining)}
                      </span>
                    )}
                  </label>
                </div>

                {streak > 0 && (
                  <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
                    {t("exercises.streak", {
                      count: streak,
                    })}
                  </div>
                )}

                <div className="pt-6">{renderExercise()}</div>
                {!showCorrection && (
                  <div className="mt-4 border-t border-[color:var(--border-color,#d1d5db)] pt-4">
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isSubmitting}
                      className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {isSubmitting
                        ? t("exercises.actions.submitting")
                        : t("exercises.actions.submit")}
                    </button>
                  </div>
                )}
              </>
            )}

            {inlineHint && (
              <div
                className="mt-4 rounded-2xl border border-[color:var(--accent,#ffd700)]/40 bg-[color:var(--accent,#ffd700)]/10 px-4 py-3 text-sm text-[color:var(--accent,#ffd700)]"
                aria-live="polite"
              >
                {inlineHint}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.hints.title")}
                  </h4>
                  <button
                    type="button"
                    onClick={revealNextHint}
                    disabled={!hintEnabled || hintDepleted}
                    className={`text-xs font-semibold underline ${
                      !hintEnabled || hintDepleted
                        ? "cursor-not-allowed text-[color:var(--muted-text,#6b7280)]"
                        : "text-[color:var(--accent,#ffd700)]"
                    }`}
                  >
                    {t("exercises.hints.showNext", {
                      cost: hintCoinCost,
                    })}
                  </button>
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                  {t("exercises.hints.credits")}{" "}
                  {hintUnlimited ? "∞" : Math.max(hintRemaining || 0, 0)}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                  {t("exercises.hints.earnMore")}
                </div>
                {hintError && (
                  <div className="mt-2 text-xs text-[color:var(--error,#dc2626)]">
                    {hintError}{" "}
                    {!hintEnabled && (
                      <button
                        type="button"
                        onClick={() => navigate("/subscriptions")}
                        className="font-semibold underline"
                      >
                        {t("exercises.hints.upgrade")}
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-3 space-y-2 text-sm text-[color:var(--muted-text,#6b7280)]">
                  {(exercises[currentExerciseIndex]?.exercise_data?.hints || [])
                    .slice(0, hintIndex)
                    .map((hint, index) => (
                      <div
                        key={`${hint}-${index}`}
                        className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-white/60 px-3 py-2"
                      >
                        {hint}
                      </div>
                    ))}
                  {hintIndex === 0 && (
                    <p className="italic">{t("exercises.hints.helper")}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4">
                <h4 className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                  {t("exercises.assist.title")}
                </h4>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    {t("exercises.assist.scratchpad")}
                  </label>
                  <textarea
                    value={scratchpad}
                    onChange={(event) => setScratchpad(event.target.value)}
                    className="h-20 w-full rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--input-bg,#f9fafb)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                    placeholder={t("exercises.assist.scratchpadPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                      {t("exercises.assist.calculator")}
                    </label>
                    <button
                      type="button"
                      onClick={() => setCalculatorOpen((prev) => !prev)}
                      className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-[11px] font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
                    >
                      {calculatorOpen
                        ? t("exercises.assist.hideCalculator")
                        : t("exercises.assist.showCalculator")}
                    </button>
                  </div>
                  {calculatorOpen && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={calculatorValue}
                          onChange={(event) =>
                            setCalculatorValue(event.target.value)
                          }
                          className="min-w-0 flex-1 rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--input-bg,#f9fafb)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/30"
                          placeholder={t(
                            "exercises.assist.calculatorPlaceholder"
                          )}
                        />
                        <button
                          type="button"
                          onClick={evaluateCalculator}
                          className="shrink-0 rounded-xl bg-[color:var(--primary,#1d5330)] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30"
                        >
                          =
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          ["7", "8", "9", "/"],
                          ["4", "5", "6", "*"],
                          ["1", "2", "3", "-"],
                          ["0", ".", "(", ")"],
                        ].flatMap((row, ri) =>
                          row.map((key) => (
                            <button
                              key={`${ri}-${key}`}
                              type="button"
                              onClick={() => appendCalculator(key)}
                              className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] shadow-sm transition hover:border-[color:var(--accent,#ffd700)]/40"
                            >
                              {key === "*" ? "×" : key}
                            </button>
                          ))
                        )}
                        <button
                          type="button"
                          onClick={() => appendCalculator("+")}
                          className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] shadow-sm transition hover:border-[color:var(--accent,#ffd700)]/40"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => appendCalculator("%")}
                          className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] shadow-sm transition hover:border-[color:var(--accent,#ffd700)]/40"
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCalculatorValue((prev) => prev.slice(0, -1))
                          }
                          className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#ffd700)]/40"
                        >
                          {t("exercises.calculator.backspace")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalculatorValue("")}
                          className="rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#ffd700)]/40"
                        >
                          {t("exercises.calculator.clear")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(submissionFeedback || showCorrection) && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 text-sm text-[color:var(--text-color,#111827)]">
                {submissionFeedback && (
                  <div className="rounded-xl border border-[color:var(--accent,#ffd700)]/40 bg-[color:var(--accent,#ffd700)]/10 px-3 py-2 text-[color:var(--accent,#ffd700)]">
                    {submissionFeedback}
                  </div>
                )}
                {showCorrection && explanation && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700">
                    <span className="font-semibold">
                      {t("exercises.explanation.remember")}
                    </span>{" "}
                    {explanation}
                  </div>
                )}
                {showCorrection &&
                  !progress[currentExerciseIndex]?.correct &&
                  currentLearnMoreUrl && (
                    <a
                      href={currentLearnMoreUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[color:var(--accent,#ffd700)] underline"
                    >
                      {t("exercises.explanation.learnMore")}
                    </a>
                  )}
                {showCorrection && !progress[currentExerciseIndex]?.correct && (
                  <button
                    type="button"
                    onClick={openTutor}
                    className="text-xs font-semibold text-[color:var(--accent,#ffd700)] underline"
                  >
                    {t("exercises.explanation.askTutor")}
                  </button>
                )}
              </div>
            )}

            {showCorrection ? (
              <div className="mt-6">
                <div className="space-y-4 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4">
                  <div
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      progress[currentExerciseIndex]?.correct
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                        : "border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                    }`}
                  >
                    {progress[currentExerciseIndex]?.correct
                      ? t("exercises.result.correct")
                      : t("exercises.result.incorrect")}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentExerciseIndex(0)}
                      disabled={currentExerciseIndex === 0}
                      className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#ffd700)] px-5 py-2 text-sm font-semibold text-[color:var(--accent,#ffd700)] transition hover:bg-[color:var(--accent,#ffd700)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("exercises.actions.restart")}
                    </button>

                    {!progress[currentExerciseIndex]?.correct && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRetrying
                          ? t("exercises.actions.retrying")
                          : t("exercises.actions.tryAgain")}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                    >
                      {currentExerciseIndex === exercises.length - 1
                        ? t("exercises.actions.finish")
                        : t("exercises.actions.next")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetchExercises();
                        setCurrentExerciseIndex(0);
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                    >
                      {t("exercises.actions.tryVariant")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </GlassCard>

          <div className="w-full space-y-6 lg:flex lg:w-80 lg:flex-col lg:self-stretch">
            <div className="relative">
              <div className="pointer-events-none sticky bottom-6">
                <MascotWithMessage
                  mood={mascotMood}
                  mascotClassName="h-24 w-24 object-contain"
                />
                {recentSkillInsight && (
                  <div className="pointer-events-auto mt-3 rounded-xl border border-[color:var(--primary,#1d5330)]/25 bg-[color:var(--card-bg,#ffffff)]/65 px-3 py-2 text-xs text-[color:var(--text-color,#111827)] shadow-sm backdrop-blur-sm animate-pulse">
                    {recentSkillInsight}
                  </div>
                )}
              </div>
            </div>
            <GlassCard padding="lg" className="lg:flex-1">
              <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                {t("exercises.progress.title")}
              </h3>
              {exercises.length > MAX_VISIBLE_PROGRESS_ITEMS && (
                <p className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                  {t("exercises.progress.showingRange", {
                    start:
                      Math.max(
                        0,
                        Math.min(
                          currentExerciseIndex -
                            Math.floor(MAX_VISIBLE_PROGRESS_ITEMS / 2),
                          exercises.length - MAX_VISIBLE_PROGRESS_ITEMS
                        )
                      ) + 1,
                    end:
                      Math.max(
                        0,
                        Math.min(
                          currentExerciseIndex -
                            Math.floor(MAX_VISIBLE_PROGRESS_ITEMS / 2),
                          exercises.length - MAX_VISIBLE_PROGRESS_ITEMS
                        )
                      ) +
                      Math.min(MAX_VISIBLE_PROGRESS_ITEMS, exercises.length),
                    total: exercises.length,
                  })}
                </p>
              )}
              <div className="mt-4 space-y-3 lg:min-h-0 lg:overflow-y-auto">
                {exercises
                  .slice(
                    Math.max(
                      0,
                      Math.min(
                        currentExerciseIndex -
                          Math.floor(MAX_VISIBLE_PROGRESS_ITEMS / 2),
                        exercises.length - MAX_VISIBLE_PROGRESS_ITEMS
                      )
                    ),
                    Math.max(
                      0,
                      Math.min(
                        currentExerciseIndex -
                          Math.floor(MAX_VISIBLE_PROGRESS_ITEMS / 2),
                        exercises.length - MAX_VISIBLE_PROGRESS_ITEMS
                      )
                    ) + Math.min(MAX_VISIBLE_PROGRESS_ITEMS, exercises.length)
                  )
                  .map((_, visibleIndex) => {
                    const startIndex = Math.max(
                      0,
                      Math.min(
                        currentExerciseIndex -
                          Math.floor(MAX_VISIBLE_PROGRESS_ITEMS / 2),
                        exercises.length - MAX_VISIBLE_PROGRESS_ITEMS
                      )
                    );
                    const index = startIndex + visibleIndex;
                    const prog = progress[index];
                    const attempted = prog !== undefined && prog !== null;
                    const isCurrent = index === currentExerciseIndex;
                    return (
                      <div
                        key={`progress-${index}`}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                          attempted
                            ? prog?.correct
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                            : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--muted-text,#6b7280)]"
                        } ${isCurrent ? "ring-1 ring-[color:var(--accent,#ffd700)]/50" : ""}`}
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              attempted
                                ? prog?.correct
                                  ? "bg-emerald-500"
                                  : "bg-[color:var(--error,#dc2626)]"
                                : "bg-[color:var(--border-color,#d1d5db)]"
                            }`}
                            aria-hidden
                          />
                          {t("exercises.progress.exercise", {
                            index: index + 1,
                          })}
                        </span>
                        <span className="text-xs uppercase tracking-wide">
                          {attempted
                            ? prog?.status === "completed"
                              ? t("exercises.progress.completed")
                              : t("exercises.progress.attempted")
                            : t("exercises.progress.pending")}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {showStats && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          style={{
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          <GlassCard
            padding="lg"
            className="relative w-full max-w-xl shadow-2xl shadow-black/30"
          >
            {animationsEnabled && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 18 }).map((_, index) => (
                  <span
                    key={`confetti-${index}`}
                    className="absolute h-2 w-2 rounded-sm animate-bounce"
                    style={{
                      left: `${(index * 17) % 100}%`,
                      top: `${(index * 11) % 100}%`,
                      backgroundColor: [
                        "#34d399",
                        "#60a5fa",
                        "#facc15",
                        "#f472b6",
                        "#f97316",
                      ][index % 5],
                      animationDelay: `${index * 0.08}s`,
                    }}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-b border-[color:var(--border-color,#d1d5db)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                <span className="mr-2">
                  <MonevoIcon name="trophy" size={18} />
                </span>{" "}
                {t("exercises.summary.title")}
              </h2>
              <button
                type="button"
                onClick={() => setShowStats(false)}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)]"
              >
                {t("exercises.summary.close")}
              </button>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="flex flex-col items-center gap-3 text-center text-sm text-emerald-700">
                <MascotMedia
                  mascot="owl"
                  className="h-24 w-24 object-contain"
                />
                <p className="font-semibold">{t("exercises.streakCongrats")}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-center text-sm text-emerald-500">
                  <h4 className="text-base font-semibold">
                    {t("exercises.progress.totalCompleted")}
                  </h4>
                  <p>
                    {t("exercises.summary.totalCompletedOf", {
                      done: stats.totalCompleted,
                      total: stats.totalExercises,
                    })}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.averageAccuracy")}
                  </h4>
                  <p>
                    {formatNumber(stats.averageAccuracy, locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    %
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.firstTryAccuracy")}
                  </h4>
                  <p>
                    {formatNumber(stats.firstTryAccuracy || 0, locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    %
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.xpEarned")}
                  </h4>
                  <p className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                    {xpTotal}
                  </p>
                  <p className="text-xs">
                    {t("exercises.summary.streakMultiplier")}:{" "}
                    {streakMultiplier > 1
                      ? `x${formatNumber(streakMultiplier, locale, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}`
                      : t("exercises.summary.none")}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.coinsEarned")}
                  </h4>
                  <p className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                    {coinsEarned}
                  </p>
                  <p className="text-xs">{t("exercises.summary.coinsHint")}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.averageAttempts")}
                  </h4>
                  <p>
                    {formatNumber(stats.averageAttempts, locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    {t("exercises.summary.perQuestion")}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.reviewDue")}
                  </h4>
                  <p>
                    {t("exercises.summary.queuedCount", {
                      count: reviewQueue.count || 0,
                    })}
                  </p>
                  {reviewQueue.due?.length > 0 && (
                    <p className="text-xs">
                      {t("exercises.summary.nextWithType", {
                        skill: reviewQueue.due[0].skill,
                        type: reviewQueue.due[0].type,
                      })}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.totalTimeSpent")}
                  </h4>
                  <p>
                    {Math.floor(stats.totalTimeSpent / 60)}m{" "}
                    {stats.totalTimeSpent % 60}s
                  </p>
                </div>
                {isTimedMode && (
                  <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)] md:col-span-2">
                    <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                      {t("exercises.summary.timeRemaining")}
                    </h4>
                    <p>{formatTime(timeRemaining)}</p>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)]">
                <h4 className="mb-2 text-base font-semibold text-[color:var(--accent,#111827)]">
                  {t("exercises.summary.missionProgress")}
                </h4>
                <p>
                  {t("exercises.summary.firstTryCorrect")}:{" "}
                  <span className="font-semibold text-[color:var(--accent,#111827)]">
                    {firstTryCorrect}
                  </span>
                </p>
                <p>
                  {t("exercises.summary.currentStreak")}:{" "}
                  <span className="font-semibold text-[color:var(--accent,#111827)]">
                    {streak}
                  </span>
                </p>
              </div>
              {Object.keys(skillGains).length > 0 && (
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-sm text-[color:var(--text-color,#111827)]">
                  <h4 className="mb-2 text-base font-semibold text-[color:var(--accent,#111827)]">
                    {t("exercises.summary.skillHighlights")}
                  </h4>
                  <ul className="space-y-1 text-[color:var(--muted-text,#6b7280)]">
                    {Object.entries(skillGains).map(([skill, gain]) => (
                      <li key={skill}>
                        <span className="font-semibold text-[color:var(--accent,#111827)]">
                          {`${skill}: +${gain} ${t("exercises.summary.masteryPoints")}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)]">
                {reviewQueue.count ? (
                  <p>
                    {t("exercises.summary.reviewCtaWithCount", {
                      count: reviewQueue.count,
                    })}
                  </p>
                ) : (
                  <p>{t("exercises.summary.reviewCtaNone")}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStats(false)}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                >
                  {t("exercises.summary.close")}
                </button>
                {reviewQueue.count > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowStats(false);
                      startReviewMode();
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#ffd700)]/50 px-5 py-2 text-sm font-semibold text-[color:var(--accent,#ffd700)] shadow-sm shadow-[color:var(--accent,#ffd700)]/20 transition hover:bg-[color:var(--accent,#ffd700)] hover:text-white"
                  >
                    {t("exercises.summary.doReviews")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowStats(false);
                    goToRecommended();
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] transition hover:border-[color:var(--accent,#ffd700)]/40 hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                >
                  {t("exercises.summary.nextRecommended")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStats(false);
                    setCurrentExerciseIndex(0);
                    setProgress([]);
                    setStreak(0);
                    setSessionCompleted(false);
                    setXpTotal(0);
                    setCoinsEarned(0);
                    setStartTime(Date.now());
                    setFirstTryCorrect(0);
                    setSkillGains({});
                    if (isTimedMode) {
                      const baseTime = 300;
                      const timePerExercise = 30;
                      setTimeRemaining(
                        baseTime + exercises.length * timePerExercise
                      );
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
                >
                  {t("exercises.summary.startNewSession")}
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default ExercisePage;
