import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import apiClient from "services/httpClient";
import Loader from "components/common/Loader";
import StatBadge from "components/common/StatBadge";
import MascotWithMessage from "components/common/MascotWithMessage";
import { useAuth } from "contexts/AuthContext";
import type { Mission, UserProfile } from "types/api";
import { GlassCard } from "components/ui";
import toast from "react-hot-toast";
import { getUserLevel } from "utils/userLevel";
import {
  getOfflineQueue,
  removeFromQueue,
  isOnline,
} from "services/offlineQueue";
import { useTranslation } from "react-i18next";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import { formatNumber } from "utils/format";
import MissionCard from "./MissionCard";
import { useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys, staleTimes } from "lib/reactQuery";

function Missions() {
  type FinanceFact = { id: number; text: string; category?: string };
  type StreakItem = {
    type: string;
    quantity: number;
    expires_at?: string | null;
  };
  const { t } = useTranslation();
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([]);
  const [weeklyMissions, setWeeklyMissions] = useState<Mission[]>([]);
  const [virtualBalance, setVirtualBalance] = useState(0);
  const { loadProfile, profile: authProfile } = useAuth();
  const [showSavingsMenu, setShowSavingsMenu] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentFact, setCurrentFact] = useState<FinanceFact | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const completedMissionsRef = useRef(new Set());
  const previousMissionsRef = useRef(new Map()); // Track previous mission states
  const isInitialLoadRef = useRef(true); // Track if this is the first load
  const savingsMenuInitializedRef = useRef(false);
  const [streakItems, setStreakItems] = useState<StreakItem[]>([]);
  const [canSwap, setCanSwap] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [missionScope, setMissionScope] = useState<"daily" | "weekly">("daily");
  const [adaptiveSuggestions, setAdaptiveSuggestions] = useState<{
    suggestedSavingsTarget: number;
    learningStyle: string;
  } | null>(null);

  const { data: profilePayload } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => loadProfile(),
    staleTime: staleTimes.profile,
    initialData: authProfile ?? undefined,
    placeholderData: (previousData) => previousData ?? authProfile ?? undefined,
  });

  const {
    data: missionsResponse,
    isLoading: missionsLoading,
    refetch: refetchMissions,
  } = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => apiClient.get("/missions/"),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const fetchSavingsBalance = useCallback(async () => {
    try {
      const response = await apiClient.get("/savings-account/");
      setVirtualBalance(response.data.balance);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        savings: t("missions.errors.loadSavings"),
      }));
    }
  }, [t]);

  const loadNewFact = useCallback(async () => {
    try {
      const response = await apiClient.get("/finance-fact/");
      setCurrentFact(response.data);
    } catch (error) {
      setCurrentFact(null);
      setErrors((prev) => ({ ...prev, fact: t("missions.errors.markFact") }));
    }
  }, [t]);

  const fetchStreakItems = useCallback(async () => {
    try {
      const response = await apiClient.get("/streak-items/");
      setStreakItems(response.data.items || []);
    } catch (error) {
      // Silently fail - streak items are optional
    }
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (!isOnline()) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        await apiClient.post("/missions/complete/", {
          mission_id: item.mission_id,
          idempotency_key: item.idempotency_key,
          first_try: item.first_try,
          hints_used: item.hints_used,
          attempts: item.attempts,
          mastery_bonus: item.mastery_bonus,
          completion_time_seconds: item.completion_time_seconds,
        });

        removeFromQueue(item.idempotency_key);
        toast.success(
          t("missions.toast.synced", {
            name: item.mission_name || t("missions.missionFallback"),
          })
        );
      } catch (error) {
        // Keep in queue if sync fails
      }
    }

    await refetchMissions();
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
  }, [refetchMissions, t]);

  const performSwap = useCallback(
    async (missionId) => {
      try {
        const response = await apiClient.post("/missions/swap/", {
          mission_id: missionId,
        });

        toast.success(
          response.data?.message || t("missions.toast.swapSuccess")
        );
        setCanSwap(false);
        await refetchMissions();
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch (error) {
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          t("missions.errors.swapFailed");

        toast.error(errorMessage, { duration: 4000 });

        if (
          error.response?.status === 400 &&
          errorMessage.includes("only swap one mission per day")
        ) {
          setCanSwap(false);
        }
      }
    },
    [refetchMissions, t]
  );

  const handleMissionSwap = useCallback(
    (missionId) => {
      if (isOffline) {
        toast.error(t("missions.swap.offlineBlocked"));
        return;
      }
      const confirmed = window.confirm(
        `${t("missions.swap.confirmTitle")}\n\n${t("missions.swap.confirmBody")}`
      );
      if (!confirmed) return;
      void performSwap(missionId);
    },
    [isOffline, performSwap, t]
  );

  const bumpMissionProgress = useCallback(
    (goalTypes: string[], completeFully = false) => {
      queryClient.setQueryData(
        queryKeys.missions(),
        (
          prev:
            | {
                data?: {
                  daily_missions?: Mission[];
                  weekly_missions?: Mission[];
                };
              }
            | undefined
        ) => {
          if (!prev?.data) return prev;
          const bump = (list?: Mission[]) =>
            (list ?? []).map((m) => {
              if (m.status === "completed") return m;
              if (!m.goal_type || !goalTypes.includes(m.goal_type)) return m;
              const current = Number(m.progress ?? 0);
              const next = completeFully ? 100 : Math.min(100, current + 25);
              return {
                ...m,
                progress: next,
                status: next >= 100 ? "completed" : m.status,
              };
            });
          return {
            ...prev,
            data: {
              ...prev.data,
              daily_missions: bump(prev.data.daily_missions),
              weekly_missions: bump(prev.data.weekly_missions),
            },
          };
        }
      );
    },
    []
  );

  useEffect(() => {
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

    // Sync queue periodically
    const syncInterval = setInterval(syncOfflineQueue, 60000);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchSavingsBalance, loadNewFact, fetchStreakItems, syncOfflineQueue]);

  useEffect(() => {
    if (!missionsResponse?.data) return;
    const daily = missionsResponse.data.daily_missions || [];
    const weekly = missionsResponse.data.weekly_missions || [];
    setDailyMissions(daily);
    setWeeklyMissions(weekly);
    if (typeof missionsResponse.data.can_swap === "boolean") {
      setCanSwap(missionsResponse.data.can_swap);
    }

    const allMissions = [...daily, ...weekly];
    if (isInitialLoadRef.current) {
      allMissions.forEach((mission) => {
        previousMissionsRef.current.set(mission.id, mission.status);
        if (mission.status === "completed") {
          completedMissionsRef.current.add(mission.id);
        }
      });
      isInitialLoadRef.current = false;
      return;
    }

    allMissions.forEach((mission) => {
      const previousStatus = previousMissionsRef.current.get(mission.id);
      const isNowCompleted = mission.status === "completed";
      const wasPreviouslyCompleted = previousStatus === "completed";
      if (isNowCompleted && !wasPreviouslyCompleted) {
        const announcement = t("missions.toast.completed", {
          name:
            (mission as { name?: string }).name ||
            t("missions.missionFallback"),
          xp: (mission as { points_reward?: number }).points_reward || 0,
        });
        setCelebrationMessage(announcement);
        toast.success(announcement, {
          icon: (
            <GarzoniIcon
              name="sparkles"
              size={18}
              className="text-[color:var(--primary)]"
            />
          ),
          duration: 3000,
        });
        completedMissionsRef.current.add(mission.id);
      }
      previousMissionsRef.current.set(mission.id, mission.status);
    });
  }, [missionsResponse, t]);

  useEffect(() => {
    if (!profilePayload) return;
    setProfile(profilePayload);

    const rawPoints =
      profilePayload?.user_data?.points ?? profilePayload?.points ?? 0;
    const points = Number(rawPoints) || 0;
    const learningStyle =
      typeof profilePayload?.user_data?.learning_style === "string"
        ? profilePayload.user_data.learning_style
        : "balanced";
    const level = getUserLevel(points);

    setAdaptiveSuggestions({
      suggestedSavingsTarget:
        level === "advanced" ? 50 : level === "intermediate" ? 25 : 10,
      learningStyle,
    });
  }, [profilePayload]);

  const markFactRead = async () => {
    if (!currentFact) return;
    try {
      await apiClient.post("/finance-fact/", {
        fact_id: currentFact.id,
      });
      bumpMissionProgress(["read_fact"], true);
      toast.success(t("missions.toast.factRead"));
      await loadNewFact();
      await refetchMissions();
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    } catch (error) {
      setErrors((prev) => ({ ...prev, fact: t("missions.errors.markFact") }));
      toast.error(t("missions.errors.markFact"));
    }
  };

  const handleSavingsSubmit = async (event) => {
    event.preventDefault();
    const amount = parseFloat(savingsAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error(t("missions.errors.validAmount"));
      return;
    }
    try {
      await apiClient.post("/savings-account/", { amount });
      setSavingsAmount("");
      bumpMissionProgress(["add_savings"]);
      toast.success(t("missions.toast.savingsAdded"));
      await fetchSavingsBalance();
      await refetchMissions();
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        savings: t("missions.errors.addSavings"),
      }));
      toast.error(t("missions.errors.addSavings"));
    }
  };

  const userLevel = useMemo(() => {
    const rawPoints = profile?.user_data?.points ?? profile?.points ?? 0;
    const points = Number(rawPoints) || 0;
    return getUserLevel(points);
  }, [profile]);

  const getLessonRequirement = (mission) => {
    const baseRequired = mission.goal_reference?.required_lessons;
    if (baseRequired) return baseRequired;
    if (userLevel === "advanced") return 3;
    if (userLevel === "intermediate") return 2;
    return 1;
  };

  const purposeStatement = (mission) => {
    if (mission.purpose_statement && mission.purpose_statement.trim()) {
      return mission.purpose_statement.trim();
    }
    switch (mission.goal_type) {
      case "complete_lesson":
        return t("missions.purpose.completeLesson");
      case "add_savings":
        return t("missions.purpose.addSavings");
      case "read_fact":
        return t("missions.purpose.readFact");
      case "complete_path":
        return t("missions.purpose.completePath");
      default:
        return t("missions.purpose.default");
    }
  };

  const suggestedSavings = useMemo(() => {
    const coinUnit = 1;
    const target = 10;
    if (virtualBalance >= target) return coinUnit;
    const remainder = virtualBalance % coinUnit;
    return remainder === 0 ? coinUnit : coinUnit - remainder;
  }, [virtualBalance]);

  // Set suggested amount only when the savings menu first opens, so the user can clear the field
  useEffect(() => {
    if (!showSavingsMenu) {
      savingsMenuInitializedRef.current = false;
      return;
    }
    if (!savingsMenuInitializedRef.current) {
      savingsMenuInitializedRef.current = true;
      setSavingsAmount(String(suggestedSavings));
    }
  }, [showSavingsMenu, suggestedSavings]);

  // ── Daily stats ─────────────────────────────────────────────────
  const dailyMissionsRemaining = dailyMissions.filter(
    (m) => m.status !== "completed"
  ).length;
  const dailyXpEarned = dailyMissions
    .filter((m) => m.status === "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const dailyXpRemaining = dailyMissions
    .filter((m) => m.status !== "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const dailyXpTotal = dailyXpEarned + dailyXpRemaining;
  const dailyCompletedCount = dailyMissions.filter(
    (m) => m.status === "completed"
  ).length;

  // ── Weekly stats ─────────────────────────────────────────────────
  const weeklyMissionsRemaining = weeklyMissions.filter(
    (m) => m.status !== "completed"
  ).length;
  const weeklyXpEarned = weeklyMissions
    .filter((m) => m.status === "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const weeklyXpRemaining = weeklyMissions
    .filter((m) => m.status !== "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const weeklyXpTotal = weeklyXpEarned + weeklyXpRemaining;
  const weeklyCompletedCount = weeklyMissions.filter(
    (m) => m.status === "completed"
  ).length;

  // ── Scope-aware stats (used in summary section) ──────────────────
  const missionsRemaining =
    missionScope === "daily" ? dailyMissionsRemaining : weeklyMissionsRemaining;
  const activeXpEarned =
    missionScope === "daily" ? dailyXpEarned : weeklyXpEarned;
  const activeXpRemaining =
    missionScope === "daily" ? dailyXpRemaining : weeklyXpRemaining;
  const activeXpTotal = missionScope === "daily" ? dailyXpTotal : weeklyXpTotal;

  const allDailyCompleted =
    dailyMissions.length > 0 && dailyMissionsRemaining === 0;
  const noMissionsAvailable =
    dailyMissions.length === 0 && weeklyMissions.length === 0;

  const rawStreakCount = profile?.user_data?.streak ?? profile?.streak ?? 0;
  const streakCount = Number(rawStreakCount) || 0;
  const reviewDue = profile?.reviews_due ?? 0;

  useEffect(() => {
    if (missionScope !== "daily") return;
    if (dailyMissions.length > 0) return;
    if (weeklyMissions.length === 0) return;
    setMissionScope("weekly");
  }, [missionScope, dailyMissions.length, weeklyMissions.length]);

  // Rendered via memoized component to avoid rebuilding a long JSX tree
  // on every parent state change.

  return (
    <section className="min-h-screen bg-surface-page px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-bold text-content-primary">
            {t("missions.header.title")}
          </h1>
          <p className="text-sm text-content-muted">
            {t("missions.header.subtitle")}
          </p>
        </header>

        <GlassCard padding="md" className="">
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:justify-between">
            {/* Left: compact "at a glance" mini-card */}
            <div className="flex-1 rounded-xl border border-[color:var(--border-color)]  px-4 py-3 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-content-muted">
                {t("missions.summary.title")}
              </p>

              <div className="mt-2 space-y-1">
                <p className="text-base font-semibold text-content-primary">
                  {t("missions.summary.remaining", {
                    count: missionsRemaining,
                  })}
                </p>
                <p className="text-sm text-content-muted">
                  {t("missions.summary.xp", {
                    earned: activeXpEarned,
                    remaining: activeXpRemaining,
                  })}
                </p>
              </div>

              {isOffline && (
                <p
                  className="mt-2 text-xs text-amber-600"
                  role="status"
                  aria-live="polite"
                >
                  <GarzoniIcon
                    name="warning"
                    size={14}
                    className="mr-2 inline-block text-amber-500"
                  />
                  {t("missions.summary.offline")}
                </p>
              )}

              {adaptiveSuggestions && (
                <div className="mt-2 inline-flex max-w-full items-start rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-3 py-1 text-[11px] font-semibold text-[color:var(--primary)] leading-tight">
                  <GarzoniIcon
                    name="lightbulb"
                    size={14}
                    className="mr-2 inline-block text-[color:var(--primary)]"
                  />
                  {t("missions.summary.suggestedSavings", {
                    amount: adaptiveSuggestions.suggestedSavingsTarget,
                    level: userLevel,
                  })}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:text-right">
              <StatBadge
                label={t("missions.summary.streak")}
                value={t("missions.summary.streakDays", { count: streakCount })}
                className=" px-4 py-3 shadow-sm"
              />
              <StatBadge
                label={
                  missionScope === "daily"
                    ? t("missions.summary.totalXp")
                    : t("missions.summary.totalXpWeekly", {
                        defaultValue: "XP this week",
                      })
                }
                value={`${formatNumber(activeXpEarned)} / ${formatNumber(activeXpTotal)}`}
                unit="XP"
                className=" px-4 py-3 shadow-sm"
              />
            </div>
          </div>
          {streakItems.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {streakItems.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--primary)]"
                  role="status"
                  aria-label={t("missions.streakItemAria", {
                    type: item.type,
                    quantity: item.quantity,
                  })}
                >
                  {item.type === "streak_freeze" ? (
                    <GarzoniIcon
                      name="snowflake"
                      size={14}
                      className="inline-block text-[color:var(--primary)]"
                    />
                  ) : (
                    <GarzoniIcon
                      name="bolt"
                      size={14}
                      className="inline-block text-[color:var(--primary)]"
                    />
                  )}
                  {item.quantity}x
                </div>
              ))}
            </div>
          )}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {celebrationMessage}
          </div>
        </GlassCard>

        {Object.values(errors).length > 0 && (
          <GlassCard
            padding="md"
            className="border-[color:var(--error)]/40 bg-[color:var(--error)]/10 text-sm text-[color:var(--error)] shadow-[color:var(--error)]/20"
          >
            <ul className="space-y-1">
              {Object.entries(errors).map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          </GlassCard>
        )}

        {!missionsLoading && !noMissionsAvailable && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMissionScope("daily")}
              disabled={dailyMissions.length === 0}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                missionScope === "daily"
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/15 text-[color:var(--primary)]"
                  : "border-[color:var(--border-color)]  text-content-muted hover:bg-[color:var(--card-bg)]"
              }`}
            >
              {t("missions.tab.dailyWithCount", {
                done: dailyCompletedCount,
                total: dailyMissions.length,
              })}
            </button>
            <button
              type="button"
              onClick={() => setMissionScope("weekly")}
              disabled={weeklyMissions.length === 0}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                missionScope === "weekly"
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)]/15 text-[color:var(--primary)]"
                  : "border-[color:var(--border-color)]  text-content-muted hover:bg-[color:var(--card-bg)]"
              }`}
            >
              {t("missions.tab.weeklyWithCount", {
                done: weeklyCompletedCount,
                total: weeklyMissions.length,
              })}
            </button>
          </div>
        )}

        {missionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader message={t("missions.loading")} />
          </div>
        ) : noMissionsAvailable ? (
          <GlassCard padding="md" className="">
            <p className="text-base font-semibold text-content-primary">
              {t("missions.empty.title")}
            </p>
            <p className="mt-1 text-sm text-content-muted">
              {t("missions.empty.body")}
            </p>
          </GlassCard>
        ) : (
          <>
            {missionScope === "daily" ? (
              <div className="grid gap-6 md:grid-cols-2">
                {dailyMissions.length > 0 ? (
                  dailyMissions.map((mission, index) => (
                    <React.Fragment key={`daily-${mission.id}-${index}`}>
                      <MissionCard
                        mission={mission}
                        isDaily
                        t={t}
                        canSwap={canSwap}
                        onSwap={handleMissionSwap}
                        showSavingsMenu={showSavingsMenu}
                        setShowSavingsMenu={setShowSavingsMenu}
                        virtualBalance={virtualBalance}
                        currentFact={currentFact}
                        onMarkFactRead={markFactRead}
                        onLoadFact={loadNewFact}
                        savingsAmount={savingsAmount}
                        setSavingsAmount={setSavingsAmount}
                        onSavingsSubmit={handleSavingsSubmit}
                        getLessonRequirement={getLessonRequirement}
                        purposeStatement={purposeStatement}
                      />
                    </React.Fragment>
                  ))
                ) : (
                  <GlassCard padding="md" className="md:col-span-2">
                    <p className="text-sm text-content-muted">
                      {t("missions.empty.body")}
                    </p>
                  </GlassCard>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-content-primary">
                  {t("missions.weekly.title")}
                </h2>
                {weeklyMissions.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {weeklyMissions.map((mission, index) => (
                      <React.Fragment key={`weekly-${mission.id}-${index}`}>
                        <MissionCard
                          mission={mission}
                          isDaily={false}
                          t={t}
                          canSwap={canSwap}
                          onSwap={handleMissionSwap}
                          showSavingsMenu={showSavingsMenu}
                          setShowSavingsMenu={setShowSavingsMenu}
                          virtualBalance={virtualBalance}
                          currentFact={currentFact}
                          onMarkFactRead={markFactRead}
                          onLoadFact={loadNewFact}
                          savingsAmount={savingsAmount}
                          setSavingsAmount={setSavingsAmount}
                          onSavingsSubmit={handleSavingsSubmit}
                          getLessonRequirement={getLessonRequirement}
                          purposeStatement={purposeStatement}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <GlassCard padding="md">
                    <p className="text-sm text-content-muted">
                      {t("missions.weekly.noneAvailable")}
                    </p>
                  </GlassCard>
                )}
              </div>
            )}

            {missionScope === "daily" && allDailyCompleted && (
              <GlassCard padding="lg" className="">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      <MascotWithMessage
                        mood="celebrate"
                        situation="missions_wrapup_all_done"
                        rotateMessages
                        rotationKey={dailyXpEarned}
                        mascotClassName="h-20 w-20 object-contain"
                        className="mt-0"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-content-muted">
                        {t("missions.wrapup.title")}
                      </p>
                      <p className="text-xl font-semibold text-[color:var(--accent)]">
                        {t("missions.wrapup.earned", {
                          xp: dailyXpEarned,
                        })}
                      </p>
                      <p className="text-sm text-content-muted">
                        {t("missions.wrapup.streakReview", {
                          count: streakCount,
                          days: streakCount,
                          review: reviewDue,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 px-4 py-3 text-sm text-[color:var(--primary)]">
                    {t("missions.wrapup.cta")}
                  </div>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default Missions;
