import React, {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import Loader from "components/common/Loader";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";
import toast from "react-hot-toast";
import {
  getOfflineQueue,
  removeFromQueue,
  isOnline,
} from "services/offlineQueue";

const initialState = {
  dailyMissions: [],
  weeklyMissions: [],
  virtualBalance: 0,
  loading: true,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "setDailyMissions":
      return { ...state, dailyMissions: action.payload };
    case "setWeeklyMissions":
      return { ...state, weeklyMissions: action.payload };
    case "setVirtualBalance":
      return { ...state, virtualBalance: action.payload };
    case "setLoading":
      return { ...state, loading: action.payload };
    case "setError":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

function CoinStack({ balance, coinUnit = 10, target = 100 }) {
  const coins = Array.from(
    { length: target / coinUnit },
    (_, index) => (index + 1) * coinUnit
  );
  const unlockedCoins = Math.floor(balance / coinUnit);

  return (
    <GlassCard padding="md" className="bg-[color:var(--bg-color,#f8fafc)]/60">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {coins.map((amount, index) => {
          const unlocked = index < unlockedCoins;
          return (
            <div
              key={amount}
              className={`coin flex h-20 flex-col items-center justify-center rounded-full border text-sm font-semibold shadow-md transition ${
                unlocked
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] text-[color:var(--muted-text,#6b7280)]"
              }`}
            >
              £{amount}
              <span className="coin-label mt-1 text-xs font-medium">
                {unlocked ? "Unlocked" : "Locked"}
              </span>
            </div>
          );
        })}
      </div>
      {balance < target && (
        <div className="coin next-unlock mt-4 rounded-2xl border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-4 py-3 text-center text-xs font-medium text-[color:var(--accent,#2563eb)]">
          Save £{coinUnit - (balance % coinUnit)} more to unlock the next coin!
        </div>
      )}
    </GlassCard>
  );
}

function FactCard({ fact, onMarkRead }) {
  return (
    <GlassCard padding="md" className="bg-[color:var(--card-bg,#ffffff)]/60">
      {fact ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent,#2563eb)]">
            {fact.category}
          </p>
          <p className="text-sm text-[color:var(--text-color,#111827)]">
            {fact.text}
          </p>
          <button
            type="button"
            onClick={onMarkRead}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            ✓ Mark as Read
          </button>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          No new financial facts available right now — check back soon!
        </p>
      )}
    </GlassCard>
  );
}

function Missions() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { getAccessToken, loadProfile } = useAuth();
  const [showSavingsMenu, setShowSavingsMenu] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentFact, setCurrentFact] = useState(null);
  const [profile, setProfile] = useState(null);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const completedMissionsRef = useRef(new Set());
  const previousMissionsRef = useRef(new Map()); // Track previous mission states
  const isInitialLoadRef = useRef(true); // Track if this is the first load
  const [streakItems, setStreakItems] = useState([]);
  const [canSwap, setCanSwap] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [adaptiveSuggestions, setAdaptiveSuggestions] = useState(null);

  const checkLessonMissionProgress = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/missions/`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      dispatch({
        type: "setDailyMissions",
        payload: response.data.daily_missions || [],
      });
    } catch (error) {
      setErrorMessage("Failed to refresh lesson mission.");
    }
  }, [getAccessToken]);

  const fetchMissions = useCallback(async () => {
    dispatch({ type: "setLoading", payload: true });
    try {
      const response = await axios.get(`${BACKEND_URL}/missions/`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      dispatch({
        type: "setDailyMissions",
        payload: response.data.daily_missions || [],
      });
      dispatch({
        type: "setWeeklyMissions",
        payload: response.data.weekly_missions || [],
      });

      const allMissions = [
        ...(response.data.daily_missions || []),
        ...(response.data.weekly_missions || []),
      ];

      // On initial load, just populate the previous state without showing toasts
      if (isInitialLoadRef.current) {
        allMissions.forEach((mission) => {
          previousMissionsRef.current.set(mission.id, mission.status);
          if (mission.status === "completed") {
            completedMissionsRef.current.add(mission.id);
          }
        });
        isInitialLoadRef.current = false;
      } else {
        // Only show completion messages for missions that just transitioned to completed
        allMissions.forEach((mission) => {
          const previousStatus = previousMissionsRef.current.get(mission.id);
          const isNowCompleted = mission.status === "completed";
          const wasPreviouslyCompleted = previousStatus === "completed";

          // Only show toast if mission just became completed (transition from not-completed to completed)
          if (isNowCompleted && !wasPreviouslyCompleted) {
            const announcement = `Completed ${mission.name} (+${mission.points_reward} XP)`;
            setCelebrationMessage(announcement);
            toast.success(announcement, {
              icon: "🎉",
              duration: 3000,
            });
            completedMissionsRef.current.add(mission.id);
          }

          // Update the previous state
          previousMissionsRef.current.set(mission.id, mission.status);
        });
      }

      // Clean up refs for missions that are no longer in the list
      const currentMissionIds = new Set(allMissions.map((m) => m.id));
      previousMissionsRef.current.forEach((_, missionId) => {
        if (!currentMissionIds.has(missionId)) {
          previousMissionsRef.current.delete(missionId);
          completedMissionsRef.current.delete(missionId);
        }
      });
    } catch (error) {
      setErrorMessage("Failed to load missions. Please try again.");
    } finally {
      dispatch({ type: "setLoading", payload: false });
    }
  }, [getAccessToken]);

  const fetchSavingsBalance = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/savings-account/`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      dispatch({ type: "setVirtualBalance", payload: response.data.balance });
    } catch (error) {
      setErrorMessage("Failed to load savings balance.");
    }
  }, [getAccessToken]);

  const loadNewFact = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/finance-fact/`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      setCurrentFact(response.data);
    } catch (error) {
      setCurrentFact(null);
    }
  }, [getAccessToken]);

  const fetchStreakItems = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/streak-items/`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      setStreakItems(response.data.items || []);
    } catch (error) {
      // Silently fail - streak items are optional
    }
  }, [getAccessToken]);

  const syncOfflineQueue = useCallback(async () => {
    if (!isOnline()) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        await axios.post(
          `${BACKEND_URL}/missions/complete/`,
          {
            mission_id: item.mission_id,
            idempotency_key: item.idempotency_key,
            first_try: item.first_try,
            hints_used: item.hints_used,
            attempts: item.attempts,
            mastery_bonus: item.mastery_bonus,
            completion_time_seconds: item.completion_time_seconds,
          },
          {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          }
        );

        removeFromQueue(item.idempotency_key);
        toast.success(`Synced: ${item.mission_name || "Mission"} completed!`);
      } catch (error) {
        // Keep in queue if sync fails
        console.error("Failed to sync mission completion:", error);
      }
    }

    await fetchMissions();
  }, [getAccessToken, fetchMissions]);

  const handleMissionSwap = useCallback(
    async (missionId) => {
      try {
        const response = await axios.post(
          `${BACKEND_URL}/missions/swap/`,
          { mission_id: missionId },
          {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          }
        );

        toast.success(
          response.data?.message || "Mission swapped successfully!"
        );
        setCanSwap(false);
        await fetchMissions();
      } catch (error) {
        // Extract error message from response
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Failed to swap mission. Please try again.";

        toast.error(errorMessage, {
          duration: 4000,
        });

        // If user has already swapped today, disable the swap button
        if (
          error.response?.status === 400 &&
          errorMessage.includes("only swap one mission per day")
        ) {
          setCanSwap(false);
        }
      }
    },
    [getAccessToken, fetchMissions]
  );

  useEffect(() => {
    const hydrateProfile = async () => {
      try {
        const profilePayload = await loadProfile();
        setProfile(profilePayload);

        // Generate adaptive suggestions based on profile
        const points =
          profilePayload?.user_data?.points ?? profilePayload?.points ?? 0;
        const level =
          points >= 2500
            ? "advanced"
            : points >= 750
            ? "intermediate"
            : "beginner";

        setAdaptiveSuggestions({
          level,
          suggestedSavingsTarget:
            level === "advanced" ? 50 : level === "intermediate" ? 25 : 10,
          learningStyle:
            profilePayload?.user_data?.learning_style || "balanced",
        });
      } catch (error) {
        setErrorMessage("Failed to load profile insights.");
      }
    };

    hydrateProfile();
    fetchMissions();
    fetchSavingsBalance();
    loadNewFact();
    fetchStreakItems();

    // Sync offline queue when online
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const lessonMissionSync = setTimeout(() => {
      checkLessonMissionProgress();
    }, 1000);

    const intervalId = setInterval(fetchMissions, 30000);

    // Sync queue periodically
    const syncInterval = setInterval(syncOfflineQueue, 60000);

    return () => {
      clearInterval(intervalId);
      clearInterval(syncInterval);
      clearTimeout(lessonMissionSync);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [
    fetchMissions,
    fetchSavingsBalance,
    loadNewFact,
    checkLessonMissionProgress,
    loadProfile,
    fetchStreakItems,
    syncOfflineQueue,
  ]);

  const markFactRead = async () => {
    if (!currentFact) return;
    try {
      await axios.post(
        `${BACKEND_URL}/finance-fact/`,
        { fact_id: currentFact.id },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      await loadNewFact();
      await fetchMissions();
    } catch (error) {
      setErrorMessage("Failed to mark fact as read.");
    }
  };

  const handleSavingsSubmit = async (event) => {
    event.preventDefault();
    const amount = parseFloat(savingsAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    try {
      await axios.post(
        `${BACKEND_URL}/savings-account/`,
        { amount },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setSavingsAmount("");
      await fetchSavingsBalance();
      await fetchMissions();
    } catch (error) {
      setErrorMessage("Failed to add savings. Please try again.");
    }
  };

  const userLevel = useMemo(() => {
    const points = profile?.user_data?.points ?? profile?.points ?? 0;
    if (points >= 2500) return "advanced";
    if (points >= 750) return "intermediate";
    return "beginner";
  }, [profile]);

  const getLessonRequirement = (mission) => {
    const baseRequired = mission.goal_reference?.required_lessons;
    if (baseRequired) return baseRequired;
    if (userLevel === "advanced") return 3;
    if (userLevel === "intermediate") return 2;
    return 1;
  };

  const purposeStatement = (mission) => {
    switch (mission.goal_type) {
      case "complete_lesson":
        return "Building lesson momentum strengthens recall and keeps your streak alive.";
      case "add_savings":
        return "Adding to your savings jar nudges you closer to your emergency fund.";
      case "read_fact":
        return "Quick money facts sharpen your intuition for smarter choices.";
      case "complete_path":
        return "Finishing a path cements mastery across related skills.";
      default:
        return "Completing this mission keeps your learning loop tight.";
    }
  };

  const suggestedSavings = useMemo(() => {
    const coinUnit = showSavingsMenu ? 1 : 1;
    const target = showSavingsMenu ? 10 : 10;
    if (state.virtualBalance >= target) return coinUnit;
    const remainder = state.virtualBalance % coinUnit;
    return remainder === 0 ? coinUnit : coinUnit - remainder;
  }, [showSavingsMenu, state.virtualBalance]);

  useEffect(() => {
    if (showSavingsMenu && !savingsAmount) {
      setSavingsAmount(String(suggestedSavings));
    }
  }, [showSavingsMenu, suggestedSavings, savingsAmount]);

  const missionsRemaining = state.dailyMissions.filter(
    (mission) => mission.status !== "completed"
  ).length;

  const dailyXpEarned = state.dailyMissions
    .filter((mission) => mission.status === "completed")
    .reduce((total, mission) => total + (mission.points_reward || 0), 0);

  const dailyXpRemaining = state.dailyMissions
    .filter((mission) => mission.status !== "completed")
    .reduce((total, mission) => total + (mission.points_reward || 0), 0);

  const dailyXpTotal = dailyXpEarned + dailyXpRemaining;

  const allDailyCompleted =
    state.dailyMissions.length > 0 && missionsRemaining === 0;

  const streakCount = profile?.user_data?.streak ?? profile?.streak ?? 0;
  const reviewDue = profile?.reviews_due ?? 0;

  const renderMissionCard = (mission, isDaily = true) => {
    const progressPercent = Math.min(100, Math.round(mission.progress ?? 0));
    const isCompleted = mission.status === "completed";

    const progressLabel =
      mission.goal_type === "read_fact" && !isDaily
        ? `${Math.floor(mission.progress / 20)}/5 Facts`
        : `${progressPercent}%`;

    const progressDetail =
      mission.goal_type === "read_fact" && isDaily
        ? "Read one fact to complete"
        : mission.goal_type === "read_fact"
        ? `${5 - Math.floor(mission.progress / 20)} of 5 facts remaining`
        : mission.goal_type === "complete_lesson"
        ? `${progressPercent}% of your ${getLessonRequirement(
            mission
          )}-lesson target`
        : `${progressPercent}% complete`;

    const completedLessons =
      mission.goal_type === "complete_lesson"
        ? Math.min(
            getLessonRequirement(mission),
            Math.round(
              (Math.max(mission.progress, 0) / 100) *
                getLessonRequirement(mission)
            )
          )
        : null;

    return (
      <GlassCard
        padding="lg"
        className="group transition hover:-translate-y-1"
        role="article"
        aria-labelledby={`mission-title-${mission.id}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
        <div className="relative">
          <header className="space-y-3 border-b border-white/20 pb-4">
            <div className="flex items-center justify-between gap-4">
              <h3
                id={`mission-title-${mission.id}`}
                className="text-lg font-semibold text-[color:var(--accent,#111827)]"
              >
                {mission.name}
              </h3>
              <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)]">
                {isDaily ? "Daily" : "Weekly"}
              </span>
            </div>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {mission.description}
            </p>
            <p className="text-xs font-semibold text-[color:var(--accent,#2563eb)]">
              Why this matters: {purposeStatement(mission)}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                <span>Progress</span>
                <span className="text-[color:var(--accent,#111827)]">
                  {progressLabel}
                </span>
              </div>
              <div
                className="h-2 rounded-full bg-[color:var(--input-bg,#f3f4f6)]"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Mission progress: ${progressPercent}%`}
              >
                <div
                  className="h-full rounded-full bg-[color:var(--primary,#2563eb)] transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                {isCompleted ? "Completed! 🎉" : progressDetail}
              </p>
              {completedLessons !== null && (
                <p className="text-[0.7rem] text-[color:var(--muted-text,#6b7280)]">
                  Level-aware target: {getLessonRequirement(mission)} lesson
                  {getLessonRequirement(mission) !== 1 ? "s" : ""}. Estimated
                  completed today: {completedLessons}.
                </p>
              )}
            </div>
          </header>

          {isCompleted ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 shadow-inner shadow-emerald-500/20">
              <div className="flex items-center justify-between font-semibold">
                <span>Mission complete</span>
                <span>+{mission.points_reward} XP</span>
              </div>
              <p className="text-[color:var(--muted-text,#047857)]">
                Great work! Keep the momentum to unlock streak and leaderboard
                boosts.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {canSwap && isDaily && (
                <button
                  type="button"
                  onClick={() => handleMissionSwap(mission.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-4 py-2 text-xs font-semibold text-[color:var(--accent,#2563eb)] transition hover:bg-[color:var(--accent,#2563eb)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  aria-label={`Swap mission: ${mission.name}`}
                >
                  🔄 Swap Mission
                </button>
              )}
              {mission.goal_type === "add_savings" && (
                <GlassCard
                  padding="md"
                  className="space-y-4 bg-[color:var(--bg-color,#f8fafc)]/60"
                >
                  <button
                    type="button"
                    onClick={() => setShowSavingsMenu((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                  >
                    {showSavingsMenu ? "Hide Savings Jar" : "Show Savings Jar"}
                  </button>
                  {showSavingsMenu && (
                    <div className="space-y-4">
                      <CoinStack
                        balance={state.virtualBalance}
                        coinUnit={isDaily ? 1 : 10}
                        target={isDaily ? 10 : 100}
                      />
                      <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
                        Suggested deposit is prefilled to unlock your next coin
                        faster.
                      </p>
                      <form
                        onSubmit={handleSavingsSubmit}
                        className="flex flex-col gap-3 sm:flex-row"
                      >
                        <input
                          type="number"
                          value={savingsAmount}
                          onChange={(event) =>
                            setSavingsAmount(event.target.value)
                          }
                          placeholder={
                            isDaily
                              ? "Enter amount (e.g., £1)"
                              : "Enter amount (e.g., £10)"
                          }
                          className="flex-1 rounded-full border border-[color:var(--border-color,#d1d5db)] bg-white px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-sm focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                          disabled={isDaily && isCompleted}
                        />
                        <button
                          type="submit"
                          disabled={isDaily && isCompleted}
                          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl hover:shadow-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDaily && isCompleted
                            ? "Saved Today"
                            : "Add to Savings"}
                        </button>
                      </form>
                    </div>
                  )}
                </GlassCard>
              )}

              {mission.goal_type === "read_fact" && isDaily && (
                <div className="space-y-3">
                  <FactCard fact={currentFact} onMarkRead={markFactRead} />
                  {!currentFact && (
                    <button
                      type="button"
                      onClick={loadNewFact}
                      className="inline-flex items-center justify-center rounded-full border border-[color:var(--accent,#2563eb)] px-4 py-2 text-xs font-semibold text-[color:var(--accent,#2563eb)] transition hover:bg-[color:var(--accent,#2563eb)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                    >
                      ↻ Try Again
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    );
  };

  return (
    <section className="min-h-screen bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            Daily Missions
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Complete focused challenges to earn rewards and strengthen your
            financial habits.
          </p>
        </header>

        <GlassCard
          padding="md"
          className="bg-[color:var(--card-bg,#ffffff)]/70"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                Progress at a glance
              </p>
              <p className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                {missionsRemaining} mission{missionsRemaining === 1 ? "" : "s"}{" "}
                left today
              </p>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {dailyXpEarned} XP earned · {dailyXpRemaining} XP still on the
                table
              </p>
              {isOffline && (
                <p
                  className="mt-2 text-xs text-amber-600"
                  role="status"
                  aria-live="polite"
                >
                  ⚠️ Offline mode - missions will sync when you're back online
                </p>
              )}
              {adaptiveSuggestions && (
                <p className="mt-2 text-xs text-[color:var(--accent,#2563eb)]">
                  💡 Suggested savings target: £
                  {adaptiveSuggestions.suggestedSavingsTarget}
                  (based on your {adaptiveSuggestions.level} level)
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-[color:var(--accent,#111827)] md:text-right">
              <div className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-white/70 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Streak
                </p>
                <p className="text-base font-semibold">{streakCount} days</p>
              </div>
              <div className="rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-white/70 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                  Total XP today
                </p>
                <p className="text-base font-semibold">
                  {dailyXpEarned} / {dailyXpTotal}
                </p>
              </div>
            </div>
          </div>
          {streakItems.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {streakItems.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className="rounded-full border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--accent,#2563eb)]"
                  role="status"
                  aria-label={`${item.type}: ${item.quantity} available`}
                >
                  {item.type === "streak_freeze" ? "❄️" : "⚡"} {item.quantity}x
                </div>
              ))}
            </div>
          )}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {celebrationMessage}
          </div>
        </GlassCard>

        {errorMessage && (
          <GlassCard
            padding="md"
            className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/20"
          >
            {errorMessage}
          </GlassCard>
        )}

        {state.loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader message="Loading missions..." />
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {state.dailyMissions.map((mission, index) => (
                <React.Fragment key={`daily-${mission.id}-${index}`}>
                  {renderMissionCard(mission, true)}
                </React.Fragment>
              ))}
            </div>

            {allDailyCompleted && (
              <GlassCard
                padding="lg"
                className="bg-[color:var(--card-bg,#ffffff)]/80"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
                      Daily mission wrap-up
                    </p>
                    <p className="text-xl font-semibold text-[color:var(--accent,#111827)]">
                      You banked {dailyXpEarned} XP today
                    </p>
                    <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                      Streak: {streakCount} day{streakCount === 1 ? "" : "s"} ·
                      Review due: {reviewDue}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--accent,#2563eb)]/40 bg-[color:var(--accent,#2563eb)]/10 px-4 py-3 text-sm text-[color:var(--accent,#2563eb)] shadow-[color:var(--accent,#2563eb)]/20">
                    Keep going! Weekly missions and reviews will boost mastery
                    next.
                  </div>
                </div>
              </GlassCard>
            )}

            {state.weeklyMissions.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-[color:var(--accent,#111827)]">
                  Weekly Missions
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {state.weeklyMissions.map((mission, index) => (
                    <React.Fragment key={`weekly-${mission.id}-${index}`}>
                      {renderMissionCard(mission, false)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default Missions;
