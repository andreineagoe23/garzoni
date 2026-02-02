import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "services/backendUrl";
import { GlassCard } from "components/ui";
import { formatNumber, getLocale } from "utils/format";
import { playFeedbackChime } from "utils/sound";

const ExercisePage = () => {
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
  const { getAccessToken, isInitialized, isAuthenticated, entitlements, settings } =
    useAuth();
  const navigate = useNavigate();
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
  const [bestTime] = useState(null);
  const timerRef = useRef(null);
  const [savedAnswers, setSavedAnswers] = useState({});
  const [isRetrying, setIsRetrying] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [hintError, setHintError] = useState("");
  const [scratchpad, setScratchpad] = useState("");
  const [calculatorValue, setCalculatorValue] = useState("");
  const [submissionFeedback, setSubmissionFeedback] = useState("");
  const [confidence, setConfidence] = useState("medium");
  const [reviewQueue, setReviewQueue] = useState({ due: [], count: 0 });
  const [xpTotal, setXpTotal] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [mode, setMode] = useState("lesson");
  const [skillGains, setSkillGains] = useState({});
  const [skillProficiency, setSkillProficiency] = useState({});
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1);
  const [inlineHint, setInlineHint] = useState("");
  const [coinsEarned, setCoinsEarned] = useState(0);
  const inlineHintTimeoutRef = useRef(null);
  const isDevelopment = process.env.NODE_ENV === "development";
  const logError = useCallback(
    (...args) => {
      if (isDevelopment) {
        console.error(...args);
      }
    },
    [isDevelopment]
  );

  const currentExercise = useMemo(
    () => exercises[currentExerciseIndex] || null,
    [exercises, currentExerciseIndex]
  );
  const hintFeature = entitlements?.features?.hints;
  const hintEnabled = hintFeature?.enabled ?? true;
  const hintRemaining = hintFeature?.remaining_today;
  const hintUnlimited = hintRemaining === null || hintRemaining === undefined;
  const hintDepleted = !hintUnlimited && hintRemaining <= 0;
  const soundEnabled = settings?.sound_enabled ?? true;
  const animationsEnabled = settings?.animations_enabled ?? true;
  const hintCoinCost = 5;

  const fetchExercises = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.category) params.append("category", filters.category);
      if (filters.difficulty) params.append("difficulty", filters.difficulty);

      const response = await axios.get(`${BACKEND_URL}/exercises/`, {
        params,
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      const validatedExercises = response.data.filter(
        (exercise) =>
          exercise.question &&
          exercise.type &&
          exercise.exercise_data &&
          ((exercise.type === "multiple-choice" &&
            Array.isArray(exercise.exercise_data.options)) ||
            (exercise.type === "numeric" &&
              typeof exercise.exercise_data?.expected_value !== "undefined") ||
            (exercise.type === "drag-and-drop" &&
              Array.isArray(exercise.exercise_data.items)) ||
            (exercise.type === "budget-allocation" &&
              Array.isArray(exercise.exercise_data.categories)) ||
            (exercise.type === "fill-in-table" &&
              Array.isArray(exercise.exercise_data?.table?.rows) &&
              Array.isArray(exercise.exercise_data?.table?.columns)) ||
            (exercise.type === "scenario-simulation" &&
              Array.isArray(exercise.exercise_data?.choices)))
      );

      setLessonExercises(validatedExercises);
      if (mode === "lesson") {
        setExercises(validatedExercises);
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to load exercises. Please try again later.");
      setLoading(false);
    }
  }, [filters, getAccessToken, mode]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/exercises/categories/`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      setCategories(response.data);
    } catch (err) {
      logError("Failed to load categories:", err);
    }
  }, [getAccessToken, logError]);

  const fetchReviewQueue = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/review-queue/`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      setReviewQueue(response.data);
    } catch (err) {
      logError("Failed to load review queue", err);
    }
  }, [getAccessToken, logError]);

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
          axios.get(`${BACKEND_URL}/exercises/${item.exercise_id}/`, {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          })
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
  }, [getAccessToken, lessonExercises, logError, reviewQueue]);

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
      const response = await axios.post(
        `${BACKEND_URL}/next/`,
        {
          last_exercise_id: lastExercise?.id,
          last_correct: progress[currentExerciseIndex]?.correct,
        },
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );

      if (response.data?.exercise_id) {
        const detail = await axios.get(
          `${BACKEND_URL}/exercises/${response.data.exercise_id}/`,
          { headers: { Authorization: `Bearer ${getAccessToken()}` } }
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
    getAccessToken,
    logError,
    lessonExercises.length,
    progress,
  ]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchCategories();
    fetchReviewQueue();
    fetchExercises();
  }, [
    isInitialized,
    isAuthenticated,
    fetchExercises,
    fetchCategories,
    fetchReviewQueue,
    navigate,
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
      setUserAnswer(initializeAnswer(currentExercise));
      setHintIndex(0);
      setHintError("");
      setSubmissionFeedback("");
      setScratchpad("");
      setConfidence("medium");
      setInlineHint("");
    }
  }, [currentExercise]);

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
    };
  }, []);

  const handleRetry = () => {
    if (!currentExercise) return;
    setIsRetrying(true);
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
        setSubmissionFeedback("Please submit an answer before continuing.");
        setShowCorrection(true);
        return;
      }

      const previousProgress = progress[currentExerciseIndex] || {};
      const wasFreshAttempt = !previousProgress.attempts;

      setSavedAnswers((prev) => ({
        ...prev,
        [currentExercise.id]: userAnswer,
      }));

      const response = await axios.post(
        `${BACKEND_URL}/exercises/${currentExercise.id}/submit/`,
        { user_answer: userAnswer, confidence, hints_used: hintIndex },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      const updated = [...progress];
      updated[currentExerciseIndex] = {
        exerciseId: currentExercise.id,
        correct: response.data.correct,
        attempts: response.data.attempts,
        status: response.data.correct ? "completed" : "attempted",
      };

      setProgress(updated);
      setExplanation(response.data.explanation || "");
      setSubmissionFeedback(response.data.feedback || "");
      playFeedbackChime({
        enabled: Boolean(soundEnabled ?? true),
        correct: Boolean(response.data.correct),
      });
      setXpTotal((prev) => prev + (response.data.xp_delta || 0));
      if (typeof response.data.coins_delta === "number") {
        setCoinsEarned((prev) => prev + response.data.coins_delta);
      }
      fetchReviewQueue();
      setShowCorrection(true);

      const inlineMessage =
        response.data.explanation ||
        (response.data.correct
          ? "Nice work! Keep going."
          : "Hint: revisit the prompt and try again.");
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

      const skill = currentExercise.category || "General";
      const before = skillProficiency[skill] || 0;
      const after = response.data.proficiency ?? before;
      setSkillProficiency((prev) => ({ ...prev, [skill]: after }));
      if (after - before > 0) {
        setSkillGains((prev) => ({
          ...prev,
          [skill]: (prev[skill] || 0) + (after - before),
        }));
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
    } catch (err) {
      setError("Submission failed. Please try again.");
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
      setHintError("Hints are unavailable on your plan. Upgrade to unlock.");
      return;
    }
    if (hintDepleted) {
      setHintError("You have used all hints for today.");
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
      setCalculatorValue("Check expression");
      return;
    }
    setCalculatorValue(String(result));
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
          Invalid exercise format
        </div>
      );
    }

    const hasResult = Boolean(showCorrection && progress[currentExerciseIndex]);
    const isAnswerCorrect = Boolean(progress[currentExerciseIndex]?.correct);
    const learnMoreUrl =
      exercise.exercise_data?.learn_more_url ||
      exercise.exercise_data?.learn_more_link ||
      "";

    switch (exercise.type) {
      case "multiple-choice":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            <div className="grid gap-3">
              {exercise.exercise_data.options.map((option, index) => {
                const id = `exercise-option-${index}`;
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition hover:border-[color:var(--accent,#2563eb)]/40 ${
                      userAnswer === index
                        ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                        : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)]"
                    } ${
                      hasResult && userAnswer === index
                        ? isAnswerCorrect
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                          : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                        : ""
                    }`}
                  >
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

      case "drag-and-drop":
        if (!Array.isArray(userAnswer)) {
          return (
            <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]">
              Error: drag-and-drop answer format invalid.
            </div>
          );
        }
        return (
          <div className="space-y-4">
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
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/plain", String(index))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
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
                    aria-label={`Drag item ${item}`}
                    className={`flex min-h-[72px] min-w-[160px] cursor-move items-center justify-center rounded-2xl border bg-[color:var(--card-bg,#ffffff)] px-4 py-3 text-sm font-medium text-[color:var(--text-color,#111827)] shadow-inner transition hover:border-[color:var(--accent,#2563eb)]/40 ${
                      hasResult && isCorrectSlot !== null
                        ? isCorrectSlot
                          ? "border-emerald-500/60 bg-emerald-500/10"
                          : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10"
                        : "border-[color:var(--border-color,#d1d5db)]"
                    }`}
                  >
                    {item}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "numeric":
        return (
          <div className="space-y-4">
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
                  exercise.exercise_data?.placeholder || "Enter a number"
                }
                className={`w-full rounded-xl border bg-[color:var(--input-bg,#f9fafb)] px-3 py-3 text-base text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30 ${
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
            {exercise.exercise_data?.validation && (
              <div className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-3 text-sm text-[color:var(--muted-text,#6b7280)]">
                {exercise.exercise_data.validation}
              </div>
            )}
          </div>
        );

      case "budget-allocation":
        return (
          <div className="space-y-4">
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
                    className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f9fafb)] backdrop-blur-sm px-3 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
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
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {exercise.question}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-2 text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                      Row
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
                        {row.label || `Row ${row.id}`}
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
                                    ...(next[row.id] || Array(columns.length).fill("")),
                                  ];
                                  rowValues[colIndex] = nextValue;
                                  next[row.id] = rowValues;
                                  return next;
                                });
                              }}
                              aria-label={`${row.label || "Row"} ${column}`}
                              className={`w-full rounded-xl border px-3 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-inner focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30 ${
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
        const selectedChoice = choices.find((choice) => choice.id === userAnswer);
        return (
          <div className="space-y-4">
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
                Action slot:
              </span>{" "}
              {selectedChoice?.label ||
                "Drag a choice here or select one below."}
            </div>
            <div className="grid gap-3">
              {choices.map((choice, index) => {
                const isSelected = userAnswer === choice.id;
                return (
                  <button
                    key={`${choice.id}-${index}`}
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/plain", String(choice.id))
                    }
                    onClick={() => setUserAnswer(choice.id)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${
                      isSelected
                        ? "border-[color:var(--accent,#2563eb)] bg-[color:var(--accent,#2563eb)]/10 text-[color:var(--accent,#2563eb)]"
                        : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--text-color,#111827)]"
                    } ${
                      hasResult && isSelected
                        ? isAnswerCorrect
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                          : "border-[color:var(--error,#dc2626)]/60 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                        : ""
                    }`}
                  >
                    <span>{choice.label}</span>
                    {isSelected && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#2563eb)]">
                        Selected
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
            Unsupported exercise type.
          </div>
        );
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-var(--top-nav-height,72px))] items-center justify-center bg-[color:var(--bg-color,#f8fafc)] px-4">
        <div className="flex items-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          Loading exercises...
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
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          >
            Retry
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
            Financial Exercises
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Practice interactive challenges to strengthen your money skills.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)] lg:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent,#2563eb)]/30 bg-[color:var(--accent,#2563eb)]/10 px-3 py-1 font-semibold text-[color:var(--accent,#2563eb)]">
              Review Queue
              <span className="rounded-full bg-[color:var(--card-bg,#ffffff)]/80 px-2 py-0.5 text-[color:var(--accent,#2563eb)]">
                Due • {reviewQueue.count || 0}
              </span>
            </span>
            {reviewQueue.due?.length > 0 && (
              <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
                Next up: {reviewQueue.due[0].skill} —{" "}
                {reviewQueue.due[0].question}
              </span>
            )}
            <button
              type="button"
              onClick={startReviewMode}
              disabled={!reviewQueue?.count}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 ${
                reviewQueue?.count
                  ? "border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--card-bg,#ffffff)] text-[color:var(--accent,#2563eb)] hover:border-[color:var(--accent,#2563eb)]/60"
                  : "cursor-not-allowed border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--muted-text,#6b7280)]"
              }`}
            >
              Start Review
            </button>
          </div>
        </header>

        {mode === "review" && exercises.length === 0 && (
          <GlassCard
            padding="lg"
            className="border-[color:var(--accent,#2563eb)]/30 bg-white"
          >
            <div className="flex flex-col gap-3 text-center">
              <p className="text-base font-semibold text-[color:var(--accent,#111827)]">
                All caught up!
              </p>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                No review items are due right now.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={exitReviewMode}
                  className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--accent,#2563eb)]/50"
                >
                  Back to lesson mode
                </button>
                <button
                  type="button"
                  onClick={fetchExercises}
                  className="rounded-full bg-[color:var(--primary,#2563eb)] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[color:var(--primary,#2563eb)]/30"
                >
                  Refresh content
                </button>
              </div>
            </div>
          </GlassCard>
        )}

        {showStats && (
          <GlassCard
            padding="md"
            className="border-emerald-500/40 bg-emerald-500/10 text-sm text-emerald-500 shadow-emerald-500/20"
          >
            🎉 Congratulations! You've completed this session. Review your stats
            or start a new round below.
          </GlassCard>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <GlassCard padding="lg" className="w-full lg:flex-1">
            <div className="grid gap-4 border-b border-white/20 pb-6 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Type
                </label>
                <select
                  value={filters.type}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                >
                  <option value="">All Types</option>
                  <option value="multiple-choice">Multiple Choice</option>
                  <option value="numeric">Numeric</option>
                  <option value="drag-and-drop">Drag and Drop</option>
                  <option value="budget-allocation">Budget Allocation</option>
                  <option value="fill-in-table">Fill In Table</option>
                  <option value="scenario-simulation">Scenario Simulation</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Difficulty
                </label>
                <select
                  value={filters.difficulty}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      difficulty: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                >
                  <option value="">All Difficulties</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-white/20 py-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[color:var(--muted-text,#6b7280)]">
                  Exercise {currentExerciseIndex + 1} of {exercises.length}
                </p>
                <div className="h-2 w-full rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
                  <div
                    className="h-2 rounded-full bg-[color:var(--primary,#2563eb)] transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)]">
                <span>Timed Mode</span>
                <div className="relative inline-flex h-6 w-11 items-center">
                  <input
                    type="checkbox"
                    checked={isTimedMode}
                    onChange={(event) => setIsTimedMode(event.target.checked)}
                    className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <span className="absolute inset-0 rounded-full bg-[color:var(--border-color,#d1d5db)] transition peer-checked:bg-[color:var(--accent,#2563eb)]" />
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                </div>
                {isTimedMode && (
                  <span className="text-xs font-semibold text-[color:var(--accent,#2563eb)]">
                    {formatTime(timeRemaining)}
                  </span>
                )}
              </label>
            </div>

            {streak > 0 && (
              <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
                🔥 You've completed {streak} exercises in a row — keep it up!
              </div>
            )}

            <div className="pt-6">{renderExercise()}</div>

            {inlineHint && (
              <div
                className="mt-4 rounded-2xl border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-4 py-3 text-sm text-[color:var(--accent,#2563eb)]"
                aria-live="polite"
              >
                {inlineHint}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    Hints
                  </h4>
                  <button
                    type="button"
                    onClick={revealNextHint}
                    disabled={!hintEnabled || hintDepleted}
                    className={`text-xs font-semibold underline ${
                      !hintEnabled || hintDepleted
                        ? "cursor-not-allowed text-[color:var(--muted-text,#6b7280)]"
                        : "text-[color:var(--accent,#2563eb)]"
                    }`}
                  >
                    Show next hint (-{hintCoinCost} coins)
                  </button>
                </div>
                <div className="mt-2 text-xs text-[color:var(--muted-text,#6b7280)]">
                  Hint credits:{" "}
                  {hintUnlimited ? "∞" : Math.max(hintRemaining || 0, 0)}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted-text,#6b7280)]">
                  Earn more hint credits via missions.
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
                        Upgrade
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
                    <p className="italic">
                      Use hints if you need a nudge. Each one costs a little XP.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4">
                <h4 className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                  Assist
                </h4>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    Scratchpad
                  </label>
                  <textarea
                    value={scratchpad}
                    onChange={(event) => setScratchpad(event.target.value)}
                    className="h-20 w-full rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--input-bg,#f9fafb)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    placeholder="Work through the steps here"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                    Calculator
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calculatorValue}
                      onChange={(event) =>
                        setCalculatorValue(event.target.value)
                      }
                      className="w-full rounded-xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--input-bg,#f9fafb)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                      placeholder="e.g. (1+0.05/12)^12-1"
                    />
                    <button
                      type="button"
                      onClick={evaluateCalculator}
                      className="rounded-xl bg-[color:var(--primary,#2563eb)] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-[color:var(--primary,#2563eb)]/30"
                    >
                      =
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {(submissionFeedback || showCorrection) && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 text-sm text-[color:var(--text-color,#111827)]">
                {submissionFeedback && (
                  <div className="rounded-xl border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-3 py-2 text-[color:var(--accent,#2563eb)]">
                    {submissionFeedback}
                  </div>
                )}
                {showCorrection && explanation && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700">
                    <span className="font-semibold">Remember:</span>{" "}
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
                      className="text-xs font-semibold text-[color:var(--accent,#2563eb)] underline"
                    >
                      Learn more about this topic
                    </a>
                  )}
                {showCorrection && !progress[currentExerciseIndex]?.correct && (
                  <button
                    type="button"
                    onClick={openTutor}
                    className="text-xs font-semibold text-[color:var(--accent,#2563eb)] underline"
                  >
                    Ask the AI tutor for a deeper explanation
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--muted-text,#6b7280)]">
                <span className="font-semibold text-[color:var(--accent,#111827)]">
                  Confidence
                </span>
                <select
                  value={confidence}
                  onChange={(event) => setConfidence(event.target.value)}
                  className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <span className="text-xs">
                  Low confidence will schedule similar practice sooner.
                </span>
              </div>

              {showCorrection ? (
                <div className="space-y-4 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4">
                  <div
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      progress[currentExerciseIndex]?.correct
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                        : "border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                    }`}
                  >
                    {progress[currentExerciseIndex]?.correct
                      ? "✅ Correct! Well done!"
                      : "❌ Incorrect. Better luck next time!"}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentExerciseIndex(0)}
                      disabled={currentExerciseIndex === 0}
                      className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#2563eb)] px-5 py-2 text-sm font-semibold text-[color:var(--accent,#2563eb)] transition hover:bg-[color:var(--accent,#2563eb)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Restart
                    </button>

                    {!progress[currentExerciseIndex]?.correct && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] transition hover:border-[color:var(--accent,#2563eb)]/40 hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRetrying ? "Retrying..." : "Try Again"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                    >
                      {currentExerciseIndex === exercises.length - 1
                        ? "Finish"
                        : "Next Exercise"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetchExercises();
                        setCurrentExerciseIndex(0);
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] transition hover:border-[color:var(--accent,#2563eb)]/40 hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                    >
                      Try Variant
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Submit Answer
                </button>
              )}
            </div>
          </GlassCard>

          <GlassCard padding="lg" className="w-full lg:w-80">
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              Your Progress
            </h3>
            <div className="mt-4 space-y-3">
              {exercises
                .map((exercise, index) => ({
                  exercise,
                  index,
                  progress: progress[index],
                }))
                .filter(
                  ({ progress: prog }) => prog !== undefined && prog !== null
                )
                .map(({ index, progress: prog }) => (
                  <div
                    key={`progress-${index}`}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      prog?.correct
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                        : "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                    }`}
                  >
                    <span className="font-medium">Exercise {index + 1}</span>
                    <span className="text-xs uppercase tracking-wide">
                      {prog?.status === "completed" ? "Completed" : "Attempted"}
                    </span>
                  </div>
                ))}
              {exercises.filter(
                (_, index) =>
                  progress[index] !== undefined && progress[index] !== null
              ).length === 0 && (
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <p>
                    No progress yet. Start an exercise to see your progress
                    here!
                  </p>
                </div>
              )}
            </div>
          </GlassCard>
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
                <span className="mr-2">🏆</span> Exercise Session Summary
              </h2>
              <button
                type="button"
                onClick={() => setShowStats(false)}
                className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#2563eb)]/40 hover:text-[color:var(--accent,#2563eb)]"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center text-sm text-emerald-700">
                <img
                  src="https://media.giphy.com/media/3o6gbbuLW76jkt8vIc/giphy.gif"
                  alt="Celebrating mascot"
                  className={`h-24 w-24 rounded-2xl object-cover ${
                    animationsEnabled ? "animate-bounce" : ""
                  }`}
                />
                <p className="font-semibold">You did it! Keep the streak alive.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-center text-sm text-emerald-500">
                  <h4 className="text-base font-semibold">Total Completed</h4>
                  <p>
                    {stats.totalCompleted} of {stats.totalExercises}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    Average Accuracy
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
                    First-Try Accuracy
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
                    XP Earned
                  </h4>
                  <p className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                    {xpTotal}
                  </p>
                  <p className="text-xs">
                    Streak multiplier:{" "}
                    {streakMultiplier > 1
                      ? `x${formatNumber(streakMultiplier, locale, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}`
                      : "none"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    Coins Earned
                  </h4>
                  <p className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                    {coinsEarned}
                  </p>
                  <p className="text-xs">
                    Earn more coins by finishing missions.
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    Average Attempts
                  </h4>
                  <p>
                    {formatNumber(stats.averageAttempts, locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    per question
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    Review Due
                  </h4>
                  <p>{reviewQueue.count || 0} exercises queued</p>
                  {reviewQueue.due?.length > 0 && (
                    <p className="text-xs">
                      Next: {reviewQueue.due[0].skill} (
                      {reviewQueue.due[0].type})
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    Total Time Spent
                  </h4>
                  <p>
                    {Math.floor(stats.totalTimeSpent / 60)}m{" "}
                    {stats.totalTimeSpent % 60}s
                  </p>
                </div>
                {isTimedMode && (
                  <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)] md:col-span-2">
                    <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                      Time Remaining
                    </h4>
                    <p>{formatTime(timeRemaining)}</p>
                    {bestTime && (
                      <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                        Best Time: {formatTime(bestTime)}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)]">
                <h4 className="mb-2 text-base font-semibold text-[color:var(--accent,#111827)]">
                  Mission progress
                </h4>
                <p>
                  First-try correct answers:{" "}
                  <span className="font-semibold text-[color:var(--accent,#111827)]">
                    {firstTryCorrect}
                  </span>
                </p>
                <p>
                  Current streak:{" "}
                  <span className="font-semibold text-[color:var(--accent,#111827)]">
                    {streak}
                  </span>
                </p>
              </div>
              {Object.keys(skillGains).length > 0 && (
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-sm text-[color:var(--text-color,#111827)]">
                  <h4 className="mb-2 text-base font-semibold text-[color:var(--accent,#111827)]">
                    Skill highlights
                  </h4>
                  <ul className="space-y-1 text-[color:var(--muted-text,#6b7280)]">
                    {Object.entries(skillGains).map(([skill, gain]) => (
                      <li key={skill}>
                        <span className="font-semibold text-[color:var(--accent,#111827)]">
                          {`${skill}: +${gain} mastery points`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-sm text-[color:var(--muted-text,#6b7280)]">
                {reviewQueue.count ? (
                  <p>
                    You have {reviewQueue.count} item(s) waiting. Do your
                    reviews now to lock in gains.
                  </p>
                ) : (
                  <p>
                    No reviews due. Continue the lesson or jump to a recommended
                    next exercise.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStats(false)}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#2563eb)]/40 hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Close
                </button>
                {reviewQueue.count > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowStats(false);
                      startReviewMode();
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#2563eb)]/50 px-5 py-2 text-sm font-semibold text-[color:var(--accent,#2563eb)] shadow-sm shadow-[color:var(--accent,#2563eb)]/20 transition hover:bg-[color:var(--accent,#2563eb)] hover:text-white"
                  >
                    Do your reviews
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowStats(false);
                    goToRecommended();
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--text-color,#111827)] transition hover:border-[color:var(--accent,#2563eb)]/40 hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Next recommended
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
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Start New Session
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
