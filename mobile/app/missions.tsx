import NetInfo from "@react-native-community/netinfo";
import {
  countdownLabel,
  fetchFinanceFact,
  fetchMissions,
  fetchProfile,
  fetchSavingsBalance,
  fetchStreakItems,
  fetchStreakWagers,
  getUserLevel,
  markFinanceFactRead,
  mergeMissionDeltas,
  msUntilDailyReset,
  msUntilWeeklyReset,
  postSavingsDeposit,
  postStreakWagerCancel,
  postStreakWagerOpen,
  queryKeys,
  resolveQuestStepRoute,
  staleTimes,
  swapMission,
  type Mission,
  type MissionActionKind,
  type MissionDelta,
  type QuestStep,
  type StreakItemDto,
  type UserProfile,
} from "@garzoni/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import MissionCard from "../src/components/engagement/MissionCard";
import MissionActionSheet from "../src/components/engagement/MissionActionSheet";
import AnimatedMissionCard from "../src/components/engagement/AnimatedMissionCard";
import StreakWagerCard from "../src/components/engagement/StreakWagerCard";
import RewardClaimModal from "../src/components/engagement/RewardClaimModal";
import { TabErrorBoundary } from "../src/components/common/TabErrorBoundary";
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  ScreenScroll,
  Skeleton,
} from "../src/components/ui";
import GlassCard from "../src/components/ui/GlassCard";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing } from "../src/theme/tokens";

type MissionsResponse = {
  daily_missions?: Mission[];
  weekly_missions?: Mission[];
  multi_step_missions?: {
    id: string | number;
    name?: string;
    description?: string;
    status?: string;
    points_reward?: number;
    steps?: QuestStep[];
  }[];
  can_swap?: boolean;
};

export default function MissionsScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [actionSheet, setActionSheet] = useState<{
    kind: MissionActionKind;
    isDaily: boolean;
  } | null>(null);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [canSwap, setCanSwap] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [missionScope, setMissionScope] = useState<
    "daily" | "weekly" | "quests"
  >("daily");
  const [claimModal, setClaimModal] = useState<{
    name: string;
    xp: number;
  } | null>(null);
  const [wagerBusy, setWagerBusy] = useState(false);
  // Re-render once a minute so the reset countdown stays honest.
  const [now, setNow] = useState(() => Date.now());

  const savingsMenuInitializedRef = useRef(false);
  const completedMissionsRef = useRef(new Set<string | number>());
  const previousMissionsRef = useRef(
    new Map<string | number, string | undefined>(),
  );
  const isInitialLoadRef = useRef(true);

  const missionsQuery = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => fetchMissions().then((r) => r.data),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data as UserProfile),
    staleTime: staleTimes.profile,
  });

  const savingsQuery = useQuery({
    queryKey: queryKeys.savingsBalance(),
    queryFn: () => fetchSavingsBalance().then((r) => r.data.balance),
    staleTime: 30_000,
  });

  const streakItemsQuery = useQuery({
    queryKey: queryKeys.streakItems(),
    queryFn: () => fetchStreakItems().then((r) => r.data.items ?? []),
    staleTime: 60_000,
  });

  const wagersQuery = useQuery({
    queryKey: queryKeys.streakWagers(),
    queryFn: () => fetchStreakWagers().then((r) => r.data),
    staleTime: 30_000,
  });

  const factQuery = useQuery({
    queryKey: queryKeys.financeFact(),
    queryFn: () => fetchFinanceFact().then((r) => r.data),
    staleTime: 60_000,
  });

  const profile = profileQuery.data;
  const dailyMissions = missionsQuery.data?.daily_missions ?? [];
  const weeklyMissions = missionsQuery.data?.weekly_missions ?? [];
  const multiStepMissions = missionsQuery.data?.multi_step_missions ?? [];
  const noMissionsAvailable =
    dailyMissions.length === 0 &&
    weeklyMissions.length === 0 &&
    multiStepMissions.length === 0;
  const virtualBalance = savingsQuery.data ?? 0;
  const streakItems: StreakItemDto[] = streakItemsQuery.data ?? [];
  const currentFact = factQuery.data ?? null;

  const dailyCompletedCount = dailyMissions.filter(
    (m) => m.status === "completed",
  ).length;
  const weeklyCompletedCount = weeklyMissions.filter(
    (m) => m.status === "completed",
  ).length;

  useEffect(() => {
    if (missionScope !== "daily") return;
    if (dailyMissions.length > 0) return;
    if (weeklyMissions.length === 0) return;
    setMissionScope("weekly");
  }, [missionScope, dailyMissions.length, weeklyMissions.length]);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return () => sub();
  }, []);

  useEffect(() => {
    if (
      missionsQuery.data &&
      typeof missionsQuery.data.can_swap === "boolean"
    ) {
      setCanSwap(missionsQuery.data.can_swap);
    }
  }, [missionsQuery.data]);

  useEffect(() => {
    if (savingsQuery.isError) {
      setErrors((prev) => ({
        ...prev,
        savings: t("missions.errors.loadSavings"),
      }));
    } else if (savingsQuery.isSuccess) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.savings;
        return next;
      });
    }
  }, [savingsQuery.isError, savingsQuery.isSuccess, t]);

  const userLevel = useMemo(() => {
    const rawPoints =
      (profile?.user_data?.points as number | undefined) ??
      profile?.points ??
      0;
    const points = Number(rawPoints) || 0;
    return getUserLevel(points);
  }, [profile]);

  const getLessonRequirement = useCallback(
    (mission: Mission) => {
      const ref = mission.goal_reference as
        { required_lessons?: number } | undefined;
      const baseRequired = ref?.required_lessons;
      if (baseRequired) return baseRequired;
      if (userLevel === "advanced") return 3;
      if (userLevel === "intermediate") return 2;
      return 1;
    },
    [userLevel],
  );

  const handleMissionAction = useCallback(
    (_mission: Mission, kind: MissionActionKind) => {
      if (kind !== "savings" && kind !== "fact") return;
      // Only the active scope is rendered, so the tab tells us the cadence.
      setActionSheet({ kind, isDaily: missionScope !== "weekly" });
    },
    [missionScope],
  );

  const suggestedSavings = useMemo(() => {
    const coinUnit = 1;
    const target = 10;
    if (virtualBalance >= target) return coinUnit;
    const remainder = virtualBalance % coinUnit;
    return remainder === 0 ? coinUnit : coinUnit - remainder;
  }, [virtualBalance]);

  useEffect(() => {
    if (actionSheet?.kind !== "savings") {
      savingsMenuInitializedRef.current = false;
      return;
    }
    if (!savingsMenuInitializedRef.current) {
      savingsMenuInitializedRef.current = true;
      setSavingsAmount(String(suggestedSavings));
    }
  }, [actionSheet?.kind, suggestedSavings]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const xpFor = (list: Mission[], completed: boolean) =>
    list
      .filter((m) =>
        completed ? m.status === "completed" : m.status !== "completed",
      )
      .reduce((total, m) => total + (m.points_reward || 0), 0);

  const dailyXpEarned = xpFor(dailyMissions, true);
  const allDailyCompleted =
    dailyMissions.length > 0 &&
    dailyMissions.every((m) => m.status === "completed");

  // ── Scope-aware stats (the summary strip used to always show daily) ──
  const isWeeklyScope = missionScope === "weekly";
  const activeMissions = isWeeklyScope ? weeklyMissions : dailyMissions;
  const activeCompletedCount = isWeeklyScope
    ? weeklyCompletedCount
    : dailyCompletedCount;
  const activeXpEarned = xpFor(activeMissions, true);
  const activeXpRemaining = xpFor(activeMissions, false);

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

  const rawStreakCount =
    (profile?.user_data?.streak as number | undefined) ?? profile?.streak ?? 0;
  const streakCount = Number(rawStreakCount) || 0;

  useEffect(() => {
    if (!missionsQuery.data) return;
    const daily = missionsQuery.data.daily_missions || [];
    const weekly = missionsQuery.data.weekly_missions || [];
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
        const name =
          (mission as { name?: string }).name || t("missions.missionFallback");
        const xp = (mission as { points_reward?: number }).points_reward || 0;
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setClaimModal({ name, xp });
        completedMissionsRef.current.add(mission.id);
      }
      previousMissionsRef.current.set(mission.id, mission.status);
    });
  }, [missionsQuery.data, t]);

  const bumpMissionProgress = useCallback(
    (goalTypes: string[], completeFully = false) => {
      queryClient.setQueryData<MissionsResponse | undefined>(
        queryKeys.missions(),
        (prev) => {
          if (!prev) return prev;
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
              } as Mission;
            });
          return {
            ...prev,
            daily_missions: bump(prev.daily_missions),
            weekly_missions: bump(prev.weekly_missions),
          };
        },
      );
    },
    [queryClient],
  );

  const loadNewFact = useCallback(() => {
    void factQuery.refetch();
  }, [factQuery]);

  const markFactRead = useCallback(async () => {
    if (!currentFact) return;
    try {
      await markFinanceFactRead(currentFact.id);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.fact;
        return next;
      });
      bumpMissionProgress(["read_fact"], true);
      setActionSheet(null);
      Toast.show({
        type: "success",
        text1: t("missions.toast.factRead"),
      });
      await factQuery.refetch();
      await missionsQuery.refetch();
    } catch {
      const msg = t("missions.errors.markFact");
      setErrors((prev) => ({ ...prev, fact: msg }));
      Toast.show({ type: "error", text1: msg });
    }
  }, [bumpMissionProgress, currentFact, factQuery, missionsQuery, t]);

  const handleSavingsSubmit = useCallback(async () => {
    Keyboard.dismiss();
    const amount = parseFloat(savingsAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      Toast.show({
        type: "error",
        text1: t("missions.errors.validAmount"),
      });
      return;
    }
    try {
      const res = await postSavingsDeposit(amount);
      setSavingsAmount("");
      setErrors((prev) => {
        const next = { ...prev };
        delete next.savings;
        return next;
      });
      // Server returns authoritative mission states for this action — merge
      // them instead of guessing progress client-side.
      const deltas: MissionDelta[] = res.data?.missions ?? [];
      if (deltas.length > 0) {
        queryClient.setQueryData<MissionsResponse | undefined>(
          queryKeys.missions(),
          (prev) => mergeMissionDeltas(prev, deltas),
        );
      } else {
        bumpMissionProgress(["add_savings"]);
      }
      setActionSheet(null);
      Toast.show({
        type: "success",
        text1: t("missions.toast.savingsAdded"),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.savingsBalance(),
      });
    } catch {
      const msg = t("missions.errors.addSavings");
      setErrors((prev) => ({ ...prev, savings: msg }));
      Toast.show({ type: "error", text1: msg });
    }
  }, [bumpMissionProgress, queryClient, savingsAmount, t]);

  const performSwap = useCallback(
    async (missionId: number) => {
      try {
        const res = await swapMission(missionId);
        setCanSwap(false);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        Toast.show({
          type: "success",
          text1: res.data?.message || t("missions.toast.swapSuccess"),
        });
        await missionsQuery.refetch();
      } catch (e: unknown) {
        const err = e as {
          response?: {
            status?: number;
            data?: { error?: string; message?: string };
          };
        };
        const msg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          t("missions.errors.swapFailed");
        Toast.show({ type: "error", text1: String(msg) });
        if (
          err.response?.status === 400 &&
          String(msg).includes("only swap one mission per day")
        ) {
          setCanSwap(false);
        }
      }
    },
    [missionsQuery, t],
  );

  const handleMissionSwap = useCallback(
    (missionId: number) => {
      if (isOffline) {
        Toast.show({
          type: "info",
          text1: t("missions.swap.offlineBlocked"),
        });
        return;
      }
      Alert.alert(
        t("missions.swap.confirmTitle"),
        t("missions.swap.confirmBody"),
        [
          { text: t("missions.swap.cancel"), style: "cancel" },
          {
            text: t("missions.swap.confirm"),
            style: "destructive",
            onPress: () => {
              void performSwap(missionId);
            },
          },
        ],
      );
    },
    [isOffline, performSwap, t],
  );

  const handleOpenWager = useCallback(
    async (targetDays: number) => {
      if (isOffline) {
        Toast.show({ type: "info", text1: t("missions.swap.offlineBlocked") });
        return;
      }
      setWagerBusy(true);
      try {
        await postStreakWagerOpen(targetDays);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        Toast.show({ type: "success", text1: t("wagers.toast.opened") });
        await wagersQuery.refetch();
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: { error?: string; message?: string } };
        };
        const msg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          t("wagers.errors.open");
        Toast.show({ type: "error", text1: String(msg) });
      } finally {
        setWagerBusy(false);
      }
    },
    [isOffline, queryClient, t, wagersQuery],
  );

  const handleCancelWager = useCallback(
    async (wagerId: number) => {
      setWagerBusy(true);
      try {
        await postStreakWagerCancel(wagerId);
        Toast.show({ type: "success", text1: t("wagers.toast.cancelled") });
        await wagersQuery.refetch();
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: { error?: string; message?: string } };
        };
        const msg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          t("wagers.errors.cancel");
        Toast.show({ type: "error", text1: String(msg) });
      } finally {
        setWagerBusy(false);
      }
    },
    [queryClient, t, wagersQuery],
  );

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        missionsQuery.refetch(),
        factQuery.refetch(),
        savingsQuery.refetch(),
        streakItemsQuery.refetch(),
        wagersQuery.refetch(),
        profileQuery.refetch(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [
    missionsQuery,
    factQuery,
    savingsQuery,
    streakItemsQuery,
    wagersQuery,
    profileQuery,
  ]);

  const errorMessages = Object.values(errors).filter(Boolean);
  const swapAllowed = canSwap && !isOffline;

  return (
    <TabErrorBoundary>
      <Stack.Screen
        options={{
          title: t("nav.missions", { defaultValue: "Missions" }),
          headerShown: true,
        }}
      />
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ScreenScroll
          contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}
          refreshControl={
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
            />
          }
        >
          <View style={styles.tabRow}>
            <Button
              variant={missionScope === "daily" ? "primary" : "ghost"}
              size="sm"
              disabled={dailyMissions.length === 0}
              onPress={() => setMissionScope("daily")}
            >
              {t("missions.tab.dailyWithCount", {
                done: dailyCompletedCount,
                total: dailyMissions.length,
              })}
            </Button>
            <Button
              variant={missionScope === "weekly" ? "primary" : "ghost"}
              size="sm"
              disabled={weeklyMissions.length === 0}
              onPress={() => setMissionScope("weekly")}
            >
              {t("missions.tab.weeklyWithCount", {
                done: weeklyCompletedCount,
                total: weeklyMissions.length,
              })}
            </Button>
            {multiStepMissions.length > 0 ? (
              <Button
                variant={missionScope === "quests" ? "primary" : "ghost"}
                size="sm"
                onPress={() => setMissionScope("quests")}
              >
                {t("missions.tab.questsWithCount", {
                  count: multiStepMissions.length,
                })}
              </Button>
            ) : null}
          </View>

          {/* Summary strip: the numbers that matter, one line. */}
          <View style={styles.strip}>
            <AppText
              variant="caption"
              style={{ color: c.text, fontWeight: "800" }}
            >
              {t("missions.strip.done", {
                done: activeCompletedCount,
                total: activeMissions.length,
              })}
            </AppText>
            <AppText variant="caption" muted>
              {activeXpRemaining > 0
                ? t("missions.strip.xpLeft", { xp: activeXpRemaining })
                : t("missions.strip.xpAllDone", { xp: activeXpEarned })}
            </AppText>
            {streakCount > 0 ? (
              <AppText variant="caption" muted>
                🔥 {t("missions.summary.streakDays", { count: streakCount })}
              </AppText>
            ) : null}
            <AppText variant="caption" style={{ color: c.primary }}>
              {resetLabel}
            </AppText>
            {streakItems.map((item, index) => (
              <AppText
                key={`${item.type}-${index}`}
                variant="caption"
                style={{ color: c.primary }}
              >
                {item.type} ×{item.quantity}
              </AppText>
            ))}
            {isOffline ? (
              <AppText variant="caption" style={styles.offline}>
                {t("missions.summary.offline")}
              </AppText>
            ) : null}
          </View>

          {errorMessages.length > 0 ? (
            <GlassCard
              padding="md"
              style={{
                marginBottom: spacing.md,
                borderColor: `${c.error}66`,
                backgroundColor: c.errorBg,
              }}
            >
              {errorMessages.map((msg, i) => (
                <AppText key={i} variant="caption" style={{ color: c.error }}>
                  {msg}
                </AppText>
              ))}
            </GlassCard>
          ) : null}

          {missionScope === "quests" && multiStepMissions.length > 0 ? (
            <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              {multiStepMissions.map((mission) => {
                const steps = mission.steps ?? [];
                const done = steps.filter((step) => step.completed).length;
                return (
                  <GlassCard key={mission.id} padding="md">
                    <View style={styles.questHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText variant="caption" muted>
                          {t("missions.quests.eyebrow")}
                        </AppText>
                        <AppText
                          style={{ fontWeight: "800", color: c.text }}
                          numberOfLines={1}
                        >
                          {mission.name}
                        </AppText>
                      </View>
                      <AppText
                        variant="caption"
                        style={{ color: c.primary, fontWeight: "800" }}
                      >
                        {t("missions.quests.steps", {
                          done,
                          total: steps.length,
                        })}
                      </AppText>
                    </View>
                    {mission.points_reward ? (
                      <AppText variant="caption" muted>
                        {t("missions.quests.reward", {
                          xp: mission.points_reward,
                        })}
                      </AppText>
                    ) : null}
                    <View style={{ gap: 2, marginTop: spacing.sm }}>
                      {steps.map((step, index) => {
                        const { mobile: route } = resolveQuestStepRoute(step);
                        const row = (
                          <View style={styles.questStep}>
                            <Ionicons
                              name={
                                step.completed
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={15}
                              color={step.completed ? c.success : c.textMuted}
                            />
                            <AppText
                              variant="caption"
                              style={{
                                flex: 1,
                                color: step.completed ? c.textMuted : c.text,
                              }}
                              numberOfLines={1}
                            >
                              {step.title}
                            </AppText>
                            {route && !step.completed ? (
                              <Ionicons
                                name="chevron-forward"
                                size={14}
                                color={c.textFaint}
                              />
                            ) : null}
                          </View>
                        );
                        return route && !step.completed ? (
                          <Pressable
                            key={step.id ?? index}
                            accessibilityRole="button"
                            onPress={() => router.push(route as Href)}
                          >
                            {row}
                          </Pressable>
                        ) : (
                          <View key={step.id ?? index}>{row}</View>
                        );
                      })}
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          ) : null}

          {missionsQuery.isPending ? (
            <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
              <Skeleton width="100%" height={100} />
              <Skeleton width="100%" height={100} />
              <Skeleton width="100%" height={100} />
            </View>
          ) : missionsQuery.isError ? (
            <ErrorState
              message={t("missions.errors.loadMissions")}
              onRetry={() => void missionsQuery.refetch()}
            />
          ) : noMissionsAvailable ? (
            <EmptyState
              icon="🎯"
              title={t("missions.empty.title")}
              message={t("missions.empty.body")}
              actionLabel={t("missions.swap.label")}
              onAction={undefined}
            />
          ) : (
            <>
              {missionScope === "quests" ? null : activeMissions.length > 0 ? (
                <View style={styles.grid}>
                  {activeMissions.map((m, index) => (
                    <AnimatedMissionCard
                      key={`${missionScope}-${m.id}-${index}`}
                      index={index}
                    >
                      <MissionCard
                        mission={m}
                        isDaily={!isWeeklyScope}
                        t={t}
                        canSwap={swapAllowed}
                        lessonRequirement={getLessonRequirement(m)}
                        onSwap={handleMissionSwap}
                        onAction={handleMissionAction}
                      />
                    </AnimatedMissionCard>
                  ))}
                </View>
              ) : (
                <AppText
                  variant="body"
                  muted
                  style={{ marginBottom: spacing.lg }}
                >
                  {isWeeklyScope
                    ? t("missions.weekly.noneAvailable")
                    : t("missions.empty.body")}
                </AppText>
              )}

              {missionScope === "daily" && allDailyCompleted ? (
                <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
                  <AppText style={{ fontWeight: "800", color: c.text }}>
                    {t("missions.wrapup.compact", { xp: dailyXpEarned })}
                  </AppText>
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ marginTop: spacing.md, alignSelf: "flex-start" }}
                    onPress={() =>
                      weeklyMissions.length > 0
                        ? setMissionScope("weekly")
                        : router.push("/(tabs)/exercises" as Href)
                    }
                  >
                    {weeklyMissions.length > 0
                      ? t("missions.wrapup.ctaWeekly")
                      : t("missions.cta.review")}
                  </Button>
                </GlassCard>
              ) : null}
            </>
          )}

          {wagersQuery.data ? (
            <StreakWagerCard
              active={wagersQuery.data.active}
              history={wagersQuery.data.history}
              stakeRewardTable={wagersQuery.data.stake_reward_table}
              eligible={wagersQuery.data.eligible}
              ineligibleReason={wagersQuery.data.ineligible_reason}
              busy={wagerBusy}
              onOpen={(targetDays) => void handleOpenWager(targetDays)}
              onCancel={(wagerId) => void handleCancelWager(wagerId)}
              t={t}
            />
          ) : null}
        </ScreenScroll>
        <MissionActionSheet
          kind={actionSheet?.kind ?? null}
          isDaily={actionSheet?.isDaily ?? true}
          t={t}
          onClose={() => setActionSheet(null)}
          virtualBalance={virtualBalance}
          savingsAmount={savingsAmount}
          onSavingsAmountChange={setSavingsAmount}
          onSavingsSubmit={() => void handleSavingsSubmit()}
          currentFact={currentFact}
          factLoading={factQuery.isFetching && !currentFact}
          onMarkFactRead={() => void markFactRead()}
          onLoadFact={loadNewFact}
        />
        <RewardClaimModal
          visible={claimModal != null}
          missionName={claimModal?.name ?? ""}
          xp={claimModal?.xp ?? 0}
          onDismiss={() => setClaimModal(null)}
        />
      </View>
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.lg },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  strip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: spacing.md,
    rowGap: 4,
    marginBottom: spacing.lg,
  },
  offline: { color: "#d97706", fontWeight: "600" },
  grid: { gap: 0 },
  questHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  questStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
