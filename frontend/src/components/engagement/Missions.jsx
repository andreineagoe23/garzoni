import React, {
  useState,
  useEffect,
  useReducer,
  useCallback,
} from "react";
import axios from "axios";
import Loader from "components/common/Loader";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

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
    <GlassCard
      padding="md"
      className="bg-[color:var(--card-bg,#ffffff)]/60"
    >
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
  const { getAccessToken } = useAuth();
  const [showSavingsMenu, setShowSavingsMenu] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentFact, setCurrentFact] = useState(null);

  const checkLessonMissionProgress = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/missions/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
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
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/missions/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      dispatch({
        type: "setDailyMissions",
        payload: response.data.daily_missions || [],
      });
      dispatch({
        type: "setWeeklyMissions",
        payload: response.data.weekly_missions || [],
      });
    } catch (error) {
      setErrorMessage("Failed to load missions. Please try again.");
    } finally {
      dispatch({ type: "setLoading", payload: false });
    }
  }, [getAccessToken]);

  const fetchSavingsBalance = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/savings-account/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      dispatch({ type: "setVirtualBalance", payload: response.data.balance });
    } catch (error) {
      setErrorMessage("Failed to load savings balance.");
    }
  }, [getAccessToken]);

  const loadNewFact = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/finance-fact/`,
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      setCurrentFact(response.data);
    } catch (error) {
      setCurrentFact(null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchMissions();
    fetchSavingsBalance();
    loadNewFact();

    const lessonMissionSync = setTimeout(() => {
      checkLessonMissionProgress();
    }, 1000);

    const intervalId = setInterval(fetchMissions, 30000);
    return () => {
      clearInterval(intervalId);
      clearTimeout(lessonMissionSync);
    };
  }, [
    fetchMissions,
    fetchSavingsBalance,
    loadNewFact,
    checkLessonMissionProgress,
  ]);

  const markFactRead = async () => {
    if (!currentFact) return;
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/finance-fact/`,
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
        `${process.env.REACT_APP_BACKEND_URL}/savings-account/`,
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

  const renderMissionCard = (mission, isDaily = true) => {
    const progressPercent = Math.min(
      100,
      Math.round(mission.progress ?? 0)
    );
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
        ? `${progressPercent}% of required lesson(s)`
        : `${progressPercent}% complete`;

    return (
      <GlassCard
        key={mission.id}
        padding="lg"
        className="group transition hover:-translate-y-1"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
        <div className="relative">
        <header className="space-y-3 border-b border-white/20 pb-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
              {mission.name}
            </h3>
            <span className="rounded-full bg-[color:var(--primary,#2563eb)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--primary,#2563eb)]">
              {isDaily ? "Daily" : "Weekly"}
            </span>
          </div>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {mission.description}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              <span>Progress</span>
              <span className="text-[color:var(--accent,#111827)]">
                {progressLabel}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[color:var(--input-bg,#f3f4f6)]">
              <div
                className="h-full rounded-full bg-[color:var(--primary,#2563eb)] transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
              {isCompleted ? "Completed! 🎉" : progressDetail}
            </p>
          </div>
        </header>

        {isCompleted ? (
          <div className="mt-4 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-500">
            Completed! 🎉
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {mission.goal_type === "add_savings" && (
              <GlassCard padding="md" className="space-y-4 bg-[color:var(--bg-color,#f8fafc)]/60">
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

        {errorMessage && (
          <GlassCard padding="md" className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/20">
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
              {state.dailyMissions.map((mission) =>
                renderMissionCard(mission, true)
              )}
            </div>

            {state.weeklyMissions.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-[color:var(--accent,#111827)]">
                  Weekly Missions
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {state.weeklyMissions.map((mission) =>
                    renderMissionCard(mission, false)
                  )}
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
