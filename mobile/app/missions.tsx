import NetInfo from "@react-native-community/netinfo";
import {
  fetchFinanceFact,
  fetchMissions,
  fetchProfile,
  fetchSavingsBalance,
  fetchStreakItems,
  getUserLevel,
  markFinanceFactRead,
  postSavingsDeposit,
  queryKeys,
  staleTimes,
  swapMission,
  type Mission,
  type StreakItemDto,
  type UserProfile,
} from "@garzoni/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import MissionCard from "../src/components/engagement/MissionCard";
import AnimatedMissionCard from "../src/components/engagement/AnimatedMissionCard";
import RewardClaimModal from "../src/components/engagement/RewardClaimModal";
import MascotWithMessage from "../src/components/common/MascotWithMessage";
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
import { spacing, typography } from "../src/theme/tokens";

type MissionsResponse = {
  daily_missions?: Mission[];
  weekly_missions?: Mission[];
  can_swap?: boolean;
};

export default function MissionsScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();

  const [showSavingsMenu, setShowSavingsMenu] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [canSwap, setCanSwap] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [missionScope, setMissionScope] = useState<"daily" | "weekly">("daily");
  const [claimModal, setClaimModal] = useState<{
    name: string;
    xp: number;
  } | null>(null);

  const savingsMenuInitializedRef = useRef(false);
  const completedMissionsRef = useRef(new Set<string | number>());
  const previousMissionsRef = useRef(
    new Map<string | number, string | undefined>(),
  );
  const isInitialLoadRef = useRef(true);

  const missionsQuery = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => fetchMissions().then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
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

  const factQuery = useQuery({
    queryKey: queryKeys.financeFact(),
    queryFn: () => fetchFinanceFact().then((r) => r.data),
    staleTime: 60_000,
  });

  const profile = profileQuery.data;
  const dailyMissions = missionsQuery.data?.daily_missions ?? [];
  const weeklyMissions = missionsQuery.data?.weekly_missions ?? [];
  const noMissionsAvailable =
    dailyMissions.length === 0 && weeklyMissions.length === 0;
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

  const adaptiveHints = useMemo(() => {
    if (!profile) return null;
    const rawPoints =
      (profile.user_data?.points as number | undefined) ?? profile.points ?? 0;
    const points = Number(rawPoints) || 0;
    const level = getUserLevel(points);
    const suggestedSavingsTarget =
      level === "advanced" ? 50 : level === "intermediate" ? 25 : 10;
    const learningStyle =
      typeof profile.user_data?.learning_style === "string"
        ? profile.user_data.learning_style
        : "balanced";
    return { suggestedSavingsTarget, learningStyle, level };
  }, [profile]);

  const getLessonRequirement = useCallback(
    (mission: Mission) => {
      const ref = mission.goal_reference as
        | { required_lessons?: number }
        | undefined;
      const baseRequired = ref?.required_lessons;
      if (baseRequired) return baseRequired;
      if (userLevel === "advanced") return 3;
      if (userLevel === "intermediate") return 2;
      return 1;
    },
    [userLevel],
  );

  const purposeStatement = useCallback(
    (mission: Mission) => {
      if (mission.purpose_statement?.trim())
        return mission.purpose_statement.trim();
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
    },
    [t],
  );

  const suggestedSavings = useMemo(() => {
    const coinUnit = 1;
    const target = 10;
    if (virtualBalance >= target) return coinUnit;
    const remainder = virtualBalance % coinUnit;
    return remainder === 0 ? coinUnit : coinUnit - remainder;
  }, [virtualBalance]);

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

  const missionsRemaining = dailyMissions.filter(
    (m) => m.status !== "completed",
  ).length;
  const dailyXpEarned = dailyMissions
    .filter((m) => m.status === "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const dailyXpRemaining = dailyMissions
    .filter((m) => m.status !== "completed")
    .reduce((total, m) => total + (m.points_reward || 0), 0);
  const dailyXpTotal = dailyXpEarned + dailyXpRemaining;
  const allDailyCompleted = dailyMissions.length > 0 && missionsRemaining === 0;

  const rawStreakCount =
    (profile?.user_data?.streak as number | undefined) ?? profile?.streak ?? 0;
  const streakCount = Number(rawStreakCount) || 0;
  const reviewDue = profile?.reviews_due ?? 0;

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
      await postSavingsDeposit(amount);
      setSavingsAmount("");
      setErrors((prev) => {
        const next = { ...prev };
        delete next.savings;
        return next;
      });
      bumpMissionProgress(["add_savings"]);
      Toast.show({
        type: "success",
        text1: t("missions.toast.savingsAdded"),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.savingsBalance(),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
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

  const onRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        missionsQuery.refetch(),
        factQuery.refetch(),
        savingsQuery.refetch(),
        streakItemsQuery.refetch(),
        profileQuery.refetch(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [missionsQuery, factQuery, savingsQuery, streakItemsQuery, profileQuery]);

  const errorMessages = Object.values(errors).filter(Boolean);
  const swapAllowed = canSwap && !isOffline;

  return (
    <TabErrorBoundary>
      <Stack.Screen
        options={{
          title: t("nav.missions", { defaultValue: "Missions" }),
          headerShown: true,
          headerTintColor: c.primary,
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
          <AppText variant="heading" accent style={styles.title}>
            {t("missions.header.title")}
          </AppText>
          <AppText variant="body" muted style={styles.sub}>
            {t("missions.header.subtitle")}
          </AppText>

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
          </View>

          <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <AppText variant="label" muted style={styles.summaryKicker}>
                  {t("missions.summary.title")}
                </AppText>
                <AppText variant="heading" accent style={styles.summaryMain}>
                  {t("missions.summary.remaining", {
                    count: missionsRemaining,
                  })}
                </AppText>
                <AppText variant="caption" muted style={styles.summaryXp}>
                  {t("missions.summary.xp", {
                    earned: dailyXpEarned,
                    remaining: dailyXpRemaining,
                  })}
                </AppText>
                {isOffline ? (
                  <AppText variant="caption" style={styles.offline}>
                    {t("missions.summary.offline")}
                  </AppText>
                ) : null}
                {adaptiveHints ? (
                  <AppText
                    variant="caption"
                    style={[
                      styles.hintChip,
                      { color: c.accent, borderColor: `${c.accent}44` },
                    ]}
                  >
                    {t("missions.summary.suggestedSavings", {
                      amount: adaptiveHints.suggestedSavingsTarget,
                      level: adaptiveHints.level,
                    })}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.statCol}>
                <View style={[styles.statBox, { backgroundColor: c.surface }]}>
                  <AppText variant="caption" muted style={styles.statLabel}>
                    {t("missions.summary.streak")}
                  </AppText>
                  <AppText variant="label" accent style={styles.statValue}>
                    {t("missions.summary.streakDays", { count: streakCount })}
                  </AppText>
                </View>
                <View style={[styles.statBox, { backgroundColor: c.surface }]}>
                  <AppText variant="caption" muted style={styles.statLabel}>
                    {t("missions.summary.totalXp")}
                  </AppText>
                  <AppText variant="label" accent style={styles.statValue}>
                    {dailyXpEarned} / {dailyXpTotal} XP
                  </AppText>
                </View>
              </View>
            </View>
            {streakItems.length > 0 ? (
              <View style={styles.streakWrap}>
                {streakItems.map((item, index) => (
                  <View
                    key={`${item.type}-${index}`}
                    style={[
                      styles.streakPill,
                      { borderColor: `${c.accent}66` },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      accent
                      style={styles.streakPillText}
                    >
                      {item.type} ×{item.quantity}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </GlassCard>

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
              {missionScope === "daily" ? (
                <View style={styles.grid}>
                  {dailyMissions.map((m, index) => (
                    <AnimatedMissionCard
                      key={`daily-${m.id}-${index}`}
                      index={index}
                    >
                      <MissionCard
                        mission={m}
                        isDaily
                        t={t}
                        canSwap={swapAllowed}
                        onSwap={handleMissionSwap}
                        showSavingsMenu={showSavingsMenu}
                        onToggleSavingsMenu={() =>
                          setShowSavingsMenu((p) => !p)
                        }
                        virtualBalance={virtualBalance}
                        currentFact={currentFact}
                        factLoading={factQuery.isFetching && !currentFact}
                        onMarkFactRead={() => void markFactRead()}
                        onLoadFact={loadNewFact}
                        savingsAmount={savingsAmount}
                        onSavingsAmountChange={setSavingsAmount}
                        onSavingsSubmit={() => void handleSavingsSubmit()}
                        getLessonRequirement={getLessonRequirement}
                        purposeStatement={purposeStatement}
                      />
                    </AnimatedMissionCard>
                  ))}
                </View>
              ) : weeklyMissions.length > 0 ? (
                <View style={styles.grid}>
                  <AppText variant="heading" accent style={styles.sectionTitle}>
                    {t("missions.weekly.title")}
                  </AppText>
                  {weeklyMissions.map((m, index) => (
                    <AnimatedMissionCard
                      key={`weekly-${m.id}-${index}`}
                      index={index}
                    >
                      <MissionCard
                        mission={m}
                        isDaily={false}
                        t={t}
                        canSwap={swapAllowed}
                        onSwap={handleMissionSwap}
                        showSavingsMenu={showSavingsMenu}
                        onToggleSavingsMenu={() =>
                          setShowSavingsMenu((p) => !p)
                        }
                        virtualBalance={virtualBalance}
                        currentFact={currentFact}
                        factLoading={factQuery.isFetching && !currentFact}
                        onMarkFactRead={() => void markFactRead()}
                        onLoadFact={loadNewFact}
                        savingsAmount={savingsAmount}
                        onSavingsAmountChange={setSavingsAmount}
                        onSavingsSubmit={() => void handleSavingsSubmit()}
                        getLessonRequirement={getLessonRequirement}
                        purposeStatement={purposeStatement}
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
                  {t("missions.weekly.title")}:{" "}
                  {t("missions.weekly.noneAvailable")}
                </AppText>
              )}

              {missionScope === "daily" && allDailyCompleted ? (
                <GlassCard padding="lg" style={{ marginBottom: spacing.lg }}>
                  <View style={styles.wrapRow}>
                    <View style={styles.wrapMascot}>
                      <MascotWithMessage
                        mood="celebrate"
                        situation="missions_wrapup_all_done"
                        rotationKey={dailyXpEarned}
                        embedded
                        mascotSize={80}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" muted style={styles.wrapKicker}>
                        {t("missions.wrapup.title")}
                      </AppText>
                      <AppText
                        variant="heading"
                        accent
                        style={styles.wrapTitle}
                      >
                        {t("missions.wrapup.earned", { xp: dailyXpEarned })}
                      </AppText>
                      <AppText variant="body" muted style={styles.wrapSub}>
                        {t("missions.wrapup.streakReview", {
                          count: streakCount,
                          days: streakCount,
                          review: reviewDue,
                        })}
                      </AppText>
                    </View>
                  </View>
                  <View
                    style={[styles.wrapCta, { borderColor: `${c.accent}66` }]}
                  >
                    <AppText
                      variant="caption"
                      accent
                      style={styles.wrapCtaText}
                    >
                      {t("missions.wrapup.cta")}
                    </AppText>
                  </View>
                </GlassCard>
              ) : null}
            </>
          )}
        </ScreenScroll>
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
  title: { fontSize: typography.xl, fontWeight: "800" },
  sub: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  summaryRow: { flexDirection: "column", gap: spacing.md },
  summaryLeft: { flex: 1 },
  summaryKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summaryMain: {
    fontSize: typography.md,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  summaryXp: { marginTop: 4 },
  offline: {
    marginTop: spacing.sm,
    color: "#d97706",
    fontWeight: "600",
  },
  hintChip: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  statCol: { flexDirection: "row", gap: spacing.sm },
  statBox: { flex: 1, padding: spacing.md, borderRadius: 12 },
  statLabel: { fontWeight: "700" },
  statValue: { fontWeight: "800", marginTop: 4 },
  streakWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  streakPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  streakPillText: { fontWeight: "700" },
  grid: { gap: 0 },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: "800",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  wrapRow: { flexDirection: "column", gap: spacing.md },
  wrapMascot: { alignItems: "center" },
  wrapKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wrapTitle: {
    fontSize: typography.lg,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  wrapSub: { marginTop: spacing.xs },
  wrapCta: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  wrapCtaText: { fontWeight: "600" },
});
