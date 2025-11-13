import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "components/ui";

const ExercisePage = () => {
  const [exercises, setExercises] = useState([]);
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
  const { getAccessToken, isInitialized, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    totalCompleted: 0,
    totalExercises: 0,
    averageAccuracy: 0,
    averageAttempts: 0,
    totalTimeSpent: 0,
  });
  const [startTime, setStartTime] = useState(Date.now());
  const [isTimedMode, setIsTimedMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [bestTime] = useState(null);
  const timerRef = useRef(null);
  const [savedAnswers, setSavedAnswers] = useState({});
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchExercises = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append("type", filters.type);
      if (filters.category) params.append("category", filters.category);
      if (filters.difficulty) params.append("difficulty", filters.difficulty);

      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/`,
        {
          params,
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      const validatedExercises = response.data.filter(
        (exercise) =>
          exercise.question &&
          exercise.type &&
          exercise.exercise_data &&
          ((exercise.type === "multiple-choice" &&
            Array.isArray(exercise.exercise_data.options)) ||
            (exercise.type === "drag-and-drop" &&
              Array.isArray(exercise.exercise_data.items)) ||
            (exercise.type === "budget-allocation" &&
              Array.isArray(exercise.exercise_data.categories)))
      );

      setExercises(validatedExercises);
      setLoading(false);
    } catch (err) {
      setError("Failed to load exercises. Please try again later.");
      setLoading(false);
    }
  }, [filters, getAccessToken]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/categories/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setCategories(response.data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchCategories();
    fetchExercises();
  }, [
    isInitialized,
    isAuthenticated,
    fetchExercises,
    fetchCategories,
    navigate,
  ]);

  const initializeAnswer = (exercise) => {
    if (!exercise) return null;

    switch (exercise.type) {
      case "drag-and-drop":
        return exercise.exercise_data.items.map((_, index) => index);
      case "budget-allocation":
        return exercise.exercise_data.categories.reduce((acc, category) => {
          acc[category] = 0;
          return acc;
        }, {});
      default:
        return null;
    }
  };

  useEffect(() => {
    if (exercises.length > 0) {
      setUserAnswer(initializeAnswer(exercises[currentExerciseIndex]));
    }
  }, [exercises, currentExerciseIndex]);

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

  const handleRetry = () => {
    setIsRetrying(true);
    const updatedProgress = [...progress];
    updatedProgress[currentExerciseIndex] = {
      exerciseId: exercises[currentExerciseIndex].id,
      correct: false,
      attempts: 0,
      status: "not_started",
    };
    setProgress(updatedProgress);

    setUserAnswer(
      savedAnswers[exercises[currentExerciseIndex].id] ||
        initializeAnswer(exercises[currentExerciseIndex])
    );

    setShowCorrection(false);
    setExplanation("");
    setIsRetrying(false);
  };

  const handleSubmit = async () => {
    try {
      const currentExercise = exercises[currentExerciseIndex];

      setSavedAnswers((prev) => ({
        ...prev,
        [currentExercise.id]: userAnswer,
      }));

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/exercises/${currentExercise.id}/submit/`,
        { user_answer: userAnswer },
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
      setShowCorrection(true);

      if (response.data.correct) {
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
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

  const handleNext = () => {
    setShowCorrection(false);
    setExplanation("");
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
    }
  };

  const renderExercise = () => {
    const exercise = exercises[currentExerciseIndex];
    if (!exercise || !exercise.exercise_data) {
      return (
        <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]">
          Invalid exercise format
        </div>
      );
    }

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
                return (
                  <div
                    key={`${item}-${index}`}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/plain", index)
                    }
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
                    className="flex min-h-[72px] min-w-[160px] cursor-move items-center justify-center rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-4 py-3 text-sm font-medium text-[color:var(--text-color,#111827)] shadow-inner transition hover:border-[color:var(--accent,#2563eb)]/40"
                  >
                    {item}
                  </div>
                );
              })}
            </div>
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
                  className="flex flex-col gap-2 rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-4"
                >
                  <span className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                    {category}
                  </span>
                  <input
                    type="number"
                    value={userAnswer[category] || 0}
                    onChange={(event) =>
                      setUserAnswer((prev) => ({
                        ...prev,
                        [category]: Math.max(
                          0,
                          parseInt(event.target.value, 10) || 0
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-white px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                  />
                </label>
              ))}
            </div>
          </div>
        );

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
        <GlassCard padding="lg" className="w-full max-w-lg border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-center text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/20">
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
        </header>

        {showStats && (
          <GlassCard padding="md" className="border-emerald-500/40 bg-emerald-500/10 text-sm text-emerald-500 shadow-emerald-500/20">
            🎉 Congratulations! You've completed this session. Review your
            stats or start a new round below.
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
                  <option value="drag-and-drop">Drag and Drop</option>
                  <option value="budget-allocation">Budget Allocation</option>
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

            {showCorrection && explanation && (
              <div className="mt-4 rounded-2xl border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-4 py-3 text-sm text-[color:var(--accent,#2563eb)]">
                💡 Explanation: {explanation}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4">
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
              {exercises.map((_, index) => (
                <div
                  key={`progress-${index}`}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                    progress[index]?.correct
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                      : progress[index]
                      ? "border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-[color:var(--error,#dc2626)]"
                      : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] text-[color:var(--muted-text,#6b7280)]"
                  }`}
                >
                  <span className="font-medium">Exercise {index + 1}</span>
                  <span className="text-xs uppercase tracking-wide">
                    {progress[index]?.status === "completed"
                      ? "Completed"
                      : progress[index]
                      ? "Attempted"
                      : "Not Started"}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {showStats && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <GlassCard padding="lg" className="w-full max-w-xl shadow-2xl shadow-black/30">
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
                  <p>{stats.averageAccuracy.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] px-4 py-4 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                  <h4 className="text-base font-semibold text-[color:var(--accent,#111827)]">
                    Average Attempts
                  </h4>
                  <p>{stats.averageAttempts.toFixed(1)} per question</p>
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
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStats(false)}
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color,#d1d5db)] px-5 py-2 text-sm font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--accent,#2563eb)]/40 hover:text-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStats(false);
                    setCurrentExerciseIndex(0);
                    setProgress([]);
                    setStreak(0);
                    setStartTime(Date.now());
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
