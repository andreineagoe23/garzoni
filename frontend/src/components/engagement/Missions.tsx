import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "services/httpClient";
import PageContainer from "components/common/PageContainer";
import Loader from "components/common/Loader";
import { useAuth } from "contexts/AuthContext";
import type { Mission, UserProfile } from "types/api";
import { GlassCard } from "components/ui";
import toast from "react-hot-toast";
import type { MissionActionKind } from "@garzoni/core";
import {
  countdownLabel,
  getMissionPresentation,
  getUserLevel,
  msUntilDailyReset,
  msUntilWeeklyReset,
  resolveQuestStepRoute,
} from "@garzoni/core";
import {
  getOfflineQueue,
  removeFromQueue,
  isOnline,
} from "services/offlineQueue";
import { useTranslation } from "react-i18next";
import { GarzoniIcon } from "components/ui/garzoniIcons";
import MissionCard from "./MissionCard";
import MissionActionModal from "./MissionActionModal";
import StreakWagerCard from "./StreakWagerCard";
import { useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys, staleTimes } from "lib/reactQuery";
import {
  fetchStreakWagers,
  postStreakWagerCancel,
  postStreakWagerOpen,
} from "services/userService";

function Missions() {
  type FinanceFact = { id: number; text: string; category?: string };
  type StreakItem = {
    type: string;
    quantity: number;
    expires_at?: string | null;
  };
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([]);
  const [weeklyMissions, setWeeklyMissions] = useState<Mission[]>([]);
  const [virtualBalance, setVirtualBalance] = useState(0);
  const { loadProfile, profile: authProfile } = useAuth();
  const [actionModal, setActionModal] = useState<{
    kind: MissionActionKind;
    isDaily: boolean;
  } | null>(null);
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
  const [missionScope, setMissionScope] = useState<
    "daily" | "weekly" | "quests"
  >("daily");
  const [wagerBusy, setWagerBusy] = useState(false);
  // Re-render once a minute so the reset countdown stays honest.
  const [now, setNow] = useState(() => Date.now());

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
  const multiStepMissions = missionsResponse?.data?.multi_step_missions || [];

  const { data: wagersResponse, refetch: refetchWagers } = useQuery({
    queryKey: queryKeys.streakWagers(),
    queryFn: () => fetchStreakWagers(),
    staleTime: 30_000,
  });
  const wagersData = wagersResponse?.data;

  const handleOpenWager = useCallback(
    async (targetDays: number) => {
      if (isOffline) {
        toast.error(t("missions.swap.offlineBlocked"));
        return;
      }
      setWagerBusy(true);
      try {
        await postStreakWagerOpen(targetDays);
        toast.success(t("wagers.toast.opened"));
        await refetchWagers();
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch (error) {
        const err = error as {
          response?: { data?: { error?: string; message?: string } };
        };
        toast.error(
          err.response?.data?.error ||
            err.response?.data?.message ||
            t("wagers.errors.open")
        );
      } finally {
        setWagerBusy(false);
      }
    },
    [isOffline, refetchWagers, t]
  );

  const handleCancelWager = useCallback(
    async (wagerId: number) => {
      setWagerBusy(true);
      try {
        await postStreakWagerCancel(wagerId);
        toast.success(t("wagers.toast.cancelled"));
        await refetchWagers();
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch (error) {
        const err = error as {
          response?: { data?: { error?: string; message?: string } };
        };
        toast.error(
          err.response?.data?.error ||
            err.response?.data?.message ||
            t("wagers.errors.cancel")
        );
      } finally {
        setWagerBusy(false);
      }
    },
    [refetchWagers, t]
  );

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
              className="text-[color:var(--color-brand-primary)]"
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
  }, [profilePayload]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const markFactRead = async () => {
    if (!currentFact) return;
    try {
      await apiClient.post("/finance-fact/", {
        fact_id: currentFact.id,
      });
      bumpMissionProgress(["read_fact"], true);
      toast.success(t("missions.toast.factRead"));
      setActionModal(null);
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
      setActionModal(null);
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

  const handleMissionAction = useCallback(
    (mission: Mission, kind: MissionActionKind) => {
      const isDaily = dailyMissions.some((m) => m.id === mission.id);
      if (kind === "savings" || kind === "fact") {
        setActionModal({ kind, isDaily });
        return;
      }
      const { webRoute } = getMissionPresentation(mission, { isDaily });
      if (webRoute) navigate(webRoute);
    },
    [dailyMissions, navigate]
  );

  const suggestedSavings = useMemo(() => {
    const coinUnit = 1;
    const target = 10;
    if (virtualBalance >= target) return coinUnit;
    const remainder = virtualBalance % coinUnit;
    return remainder === 0 ? coinUnit : coinUnit - remainder;
  }, [virtualBalance]);

  // Set suggested amount only when the savings sheet first opens, so the user can clear the field
  useEffect(() => {
    if (actionModal?.kind !== "savings") {
      savingsMenuInitializedRef.current = false;
      return;
    }
    if (!savingsMenuInitializedRef.current) {
      savingsMenuInitializedRef.current = true;
      setSavingsAmount(String(suggestedSavings));
    }
  }, [actionModal?.kind, suggestedSavings]);

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
  const dailyCompletedCount = dailyMissions.filter(
    (m) => m.status === "completed"
  ).length;

  // ── Weekly stats ─────────────────────────────────────────────────
  const weeklyXpEarned = weeklyMissions
    .filter((m) => m.status === "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const weeklyXpRemaining = weeklyMissions
    .filter((m) => m.status !== "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const weeklyCompletedCount = weeklyMissions.filter(
    (m) => m.status === "completed"
  ).length;

  // ── Scope-aware stats (used in the summary strip) ────────────────
  const isWeeklyScope = missionScope === "weekly";
  const activeMissions = isWeeklyScope ? weeklyMissions : dailyMissions;
  const activeCompletedCount = isWeeklyScope
    ? weeklyCompletedCount
    : dailyCompletedCount;
  const activeXpEarned = isWeeklyScope ? weeklyXpEarned : dailyXpEarned;
  const activeXpRemaining = isWeeklyScope
    ? weeklyXpRemaining
    : dailyXpRemaining;

  const resetLabel = useMemo(() => {
    const ms = isWeeklyScope
      ? msUntilWeeklyReset(new Date(now))
      : msUntilDailyReset(new Date(now));
    const { key, params } = countdownLabel(ms);
    const prefix = isWeeklyScope
      ? t("missions.reset.weeklyPrefix")
      : t("missions.reset.dailyPrefix");
    return `${prefix} ${t(key, params)}`;
  }, [isWeeklyScope, now, t]);

  const allDailyCompleted =
    dailyMissions.length > 0 && dailyMissionsRemaining === 0;
  const noMissionsAvailable =
    dailyMissions.length === 0 &&
    weeklyMissions.length === 0 &&
    multiStepMissions.length === 0;

  const rawStreakCount = profile?.user_data?.streak ?? profile?.streak ?? 0;
  const streakCount = Number(rawStreakCount) || 0;

  useEffect(() => {
    if (missionScope !== "daily") return;
    if (dailyMissions.length > 0) return;
    if (weeklyMissions.length === 0) return;
    setMissionScope("weekly");
  }, [missionScope, dailyMissions.length, weeklyMissions.length]);

  // Rendered via memoized component to avoid rebuilding a long JSX tree
  // on every parent state change.

  return (
    <PageContainer maxWidth="4xl" gap="stack">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold text-content-primary">
          {t("missions.header.short")}
        </h1>
        <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border-default)] px-3 py-1 text-xs font-semibold text-content-muted">
          <GarzoniIcon name="hourglass" size={12} />
          {resetLabel}
        </span>
      </header>

      {/* Summary strip: the three numbers that matter, one line. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-content-muted">
        <span className="font-semibold text-content-primary">
          {t("missions.strip.done", {
            done: activeCompletedCount,
            total: activeMissions.length,
          })}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {activeXpRemaining > 0
            ? t("missions.strip.xpLeft", { xp: activeXpRemaining })
            : t("missions.strip.xpAllDone", { xp: activeXpEarned })}
        </span>
        {streakCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <GarzoniIcon
                name="fire"
                size={12}
                className="text-[color:var(--color-brand-primary-hover)]"
              />
              {t("missions.summary.streakDays", { count: streakCount })}
            </span>
          </>
        )}
        {streakItems.map((item, index) => (
          <span
            key={`${item.type}-${index}`}
            className="inline-flex items-center gap-1 text-[color:var(--color-brand-primary)]"
            aria-label={t("missions.streakItemAria", {
              type: item.type,
              quantity: item.quantity,
            })}
          >
            <GarzoniIcon
              name={item.type === "streak_freeze" ? "snowflake" : "bolt"}
              size={12}
            />
            {item.quantity}x
          </span>
        ))}
        {isOffline && (
          <span
            className="inline-flex items-center gap-1 text-amber-600"
            role="status"
            aria-live="polite"
          >
            <GarzoniIcon name="warning" size={12} />
            {t("missions.summary.offline")}
          </span>
        )}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {celebrationMessage}
      </div>

      {Object.values(errors).length > 0 && (
        <GlassCard
          padding="md"
          className="border-[color:var(--color-state-error)]/40 bg-[color:var(--color-state-error)]/10 text-sm text-[color:var(--color-state-error)] shadow-[color:var(--color-state-error)]/20"
        >
          <ul className="space-y-1">
            {Object.entries(errors).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </GlassCard>
      )}

      {!missionsLoading && !noMissionsAvailable && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {(
            [
              {
                scope: "daily" as const,
                label: t("missions.tab.dailyWithCount", {
                  done: dailyCompletedCount,
                  total: dailyMissions.length,
                }),
                disabled: dailyMissions.length === 0,
              },
              {
                scope: "weekly" as const,
                label: t("missions.tab.weeklyWithCount", {
                  done: weeklyCompletedCount,
                  total: weeklyMissions.length,
                }),
                disabled: weeklyMissions.length === 0,
              },
              ...(multiStepMissions.length > 0
                ? [
                    {
                      scope: "quests" as const,
                      label: t("missions.tab.questsWithCount", {
                        count: multiStepMissions.length,
                      }),
                      disabled: false,
                    },
                  ]
                : []),
            ] as const
          ).map(({ scope, label, disabled }) => {
            const selected = missionScope === scope;
            return (
              <button
                key={scope}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setMissionScope(scope)}
                disabled={disabled}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-[color:var(--color-brand-primary)] bg-[color:var(--color-brand-primary)]/15 text-[color:var(--color-brand-primary)]"
                    : "border-[color:var(--color-border-default)] text-content-muted hover:bg-[color:var(--color-surface-card)]"
                }`}
              >
                {label}
              </button>
            );
          })}
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
          {missionScope === "quests" ? (
            <div className="grid gap-3">
              {multiStepMissions.map((mission) => {
                const steps = mission.steps || [];
                const done = steps.filter((step) => step.completed).length;
                return (
                  <div
                    key={mission.id}
                    className="app-card app-card--pad-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="app-eyebrow text-content-muted">
                          {t("missions.quests.eyebrow")}
                        </p>
                        <h2 className="truncate text-sm font-semibold text-content-primary">
                          {mission.name}
                        </h2>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold">
                        {mission.points_reward ? (
                          <span className="text-[color:var(--color-brand-primary)]">
                            {t("missions.quests.reward", {
                              xp: mission.points_reward,
                            })}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-[color:var(--color-border-default)] px-2 py-0.5 text-content-muted">
                          {t("missions.quests.steps", {
                            done,
                            total: steps.length,
                          })}
                        </span>
                      </div>
                    </div>
                    <ol className="grid gap-1.5">
                      {steps.map((step, index) => {
                        const { web: route } = resolveQuestStepRoute(step);
                        const content = (
                          <>
                            <GarzoniIcon
                              name={step.completed ? "check" : "target"}
                              size={13}
                              className={
                                step.completed
                                  ? "text-emerald-600"
                                  : "text-content-muted"
                              }
                            />
                            <span
                              className={`min-w-0 flex-1 truncate ${
                                step.completed
                                  ? "text-content-muted line-through"
                                  : "text-content-primary"
                              }`}
                            >
                              {step.title}
                            </span>
                          </>
                        );
                        const rowClass =
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs";
                        return (
                          <li key={step.id || index}>
                            {route && !step.completed ? (
                              <button
                                type="button"
                                onClick={() => navigate(route)}
                                className={`${rowClass} w-full text-left transition hover:bg-[color:var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40`}
                              >
                                {content}
                              </button>
                            ) : (
                              <div className={rowClass}>{content}</div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>
          ) : activeMissions.length > 0 ? (
            <div className="grid gap-3">
              {activeMissions.map((mission, index) => (
                <MissionCard
                  key={`${missionScope}-${mission.id}-${index}`}
                  mission={mission}
                  isDaily={!isWeeklyScope}
                  t={t}
                  canSwap={canSwap}
                  lessonRequirement={getLessonRequirement(mission)}
                  onSwap={handleMissionSwap}
                  onAction={handleMissionAction}
                />
              ))}
            </div>
          ) : (
            <GlassCard padding="md">
              <p className="text-sm text-content-muted">
                {isWeeklyScope
                  ? t("missions.weekly.noneAvailable")
                  : t("missions.empty.body")}
              </p>
            </GlassCard>
          )}

          {missionScope === "daily" && allDailyCompleted && (
            <div className="app-card app-card--pad-sm flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-content-primary">
                {t("missions.wrapup.compact", { xp: dailyXpEarned })}
              </p>
              <button
                type="button"
                onClick={() =>
                  weeklyMissions.length > 0
                    ? setMissionScope("weekly")
                    : navigate("/exercises")
                }
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]/40"
              >
                {weeklyMissions.length > 0
                  ? t("missions.wrapup.ctaWeekly")
                  : t("missions.cta.review")}
              </button>
            </div>
          )}
        </>
      )}

      {wagersData && (
        <StreakWagerCard
          active={wagersData.active}
          history={wagersData.history}
          stakeRewardTable={wagersData.stake_reward_table}
          eligible={wagersData.eligible}
          ineligibleReason={wagersData.ineligible_reason}
          busy={wagerBusy}
          onOpen={(targetDays) => void handleOpenWager(targetDays)}
          onCancel={(wagerId) => void handleCancelWager(wagerId)}
          t={t}
        />
      )}

      <MissionActionModal
        kind={actionModal?.kind ?? null}
        isDaily={actionModal?.isDaily ?? true}
        t={t}
        onClose={() => setActionModal(null)}
        virtualBalance={virtualBalance}
        savingsAmount={savingsAmount}
        setSavingsAmount={setSavingsAmount}
        onSavingsSubmit={handleSavingsSubmit}
        currentFact={currentFact}
        onMarkFactRead={markFactRead}
        onLoadFact={loadNewFact}
      />
    </PageContainer>
  );
}

export default Missions;
