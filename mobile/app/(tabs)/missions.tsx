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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MissionCard from "../../src/components/engagement/MissionCard";
import AnimatedMissionCard from "../../src/components/engagement/AnimatedMissionCard";
import RewardClaimModal from "../../src/components/engagement/RewardClaimModal";
import MascotWithMessage from "../../src/components/common/MascotWithMessage";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { ErrorState, ScreenScroll, Skeleton } from "../../src/components/ui";
import GlassCard from "../../src/components/ui/GlassCard";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { spacing, typography } from "../../src/theme/tokens";

function MissionsInner() {
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
  const virtualBalance = savingsQuery.data ?? 0;
  const streakItems: StreakItemDto[] = streakItemsQuery.data ?? [];
  const currentFact = factQuery.data ?? null;

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
      await factQuery.refetch();
      await missionsQuery.refetch();
    } catch {
      const msg = t("missions.errors.markFact");
      setErrors((prev) => ({ ...prev, fact: msg }));
      Alert.alert("", msg);
    }
  }, [currentFact, factQuery, missionsQuery, t]);

  const handleSavingsSubmit = useCallback(async () => {
    Keyboard.dismiss();
    const amount = parseFloat(savingsAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert("", t("missions.errors.validAmount"));
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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.savingsBalance(),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.missions() });
    } catch {
      const msg = t("missions.errors.addSavings");
      setErrors((prev) => ({ ...prev, savings: msg }));
      Alert.alert("", msg);
    }
  }, [queryClient, savingsAmount, t]);

  const handleMissionSwap = useCallback(
    async (missionId: number) => {
      try {
        const res = await swapMission(missionId);
        setCanSwap(false);
        Alert.alert("", res.data?.message || t("missions.toast.swapSuccess"));
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
        Alert.alert("", String(msg));
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

  return (
    <>
      {/*
        Expiring-mission push reminders: use expo-notifications + server or local scheduling in a
        dedicated change (credentials, copy, quiet hours).
      */}
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
        <Text style={[styles.title, { color: c.accent }]}>
          {t("missions.header.title")}
        </Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {t("missions.header.subtitle")}
        </Text>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setMissionScope("daily")}
            style={[
              styles.tabChip,
              {
                borderColor: c.border,
                backgroundColor:
                  missionScope === "daily" ? c.accentMuted : c.surface,
              },
            ]}
          >
            <Text style={{ color: c.text, fontWeight: "700" }}>
              {t("missions.badge.daily")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMissionScope("weekly")}
            style={[
              styles.tabChip,
              {
                borderColor: c.border,
                backgroundColor:
                  missionScope === "weekly" ? c.accentMuted : c.surface,
              },
            ]}
          >
            <Text style={{ color: c.text, fontWeight: "700" }}>
              {t("missions.badge.weekly")}
            </Text>
          </Pressable>
        </View>

        <GlassCard padding="md" style={{ marginBottom: spacing.lg }}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <Text style={[styles.summaryKicker, { color: c.textMuted }]}>
                {t("missions.summary.title")}
              </Text>
              <Text style={[styles.summaryMain, { color: c.accent }]}>
                {t("missions.summary.remaining", { count: missionsRemaining })}
              </Text>
              <Text style={[styles.summaryXp, { color: c.textMuted }]}>
                {t("missions.summary.xp", {
                  earned: dailyXpEarned,
                  remaining: dailyXpRemaining,
                })}
              </Text>
              {isOffline ? (
                <Text style={styles.offline}>
                  {t("missions.summary.offline")}
                </Text>
              ) : null}
              {adaptiveHints ? (
                <Text
                  style={[
                    styles.hintChip,
                    { color: c.accent, borderColor: `${c.accent}44` },
                  ]}
                >
                  {t("missions.summary.suggestedSavings", {
                    amount: adaptiveHints.suggestedSavingsTarget,
                    level: adaptiveHints.level,
                  })}
                </Text>
              ) : null}
            </View>
            <View style={styles.statCol}>
              <View style={[styles.statBox, { backgroundColor: c.surface }]}>
                <Text style={[styles.statLabel, { color: c.textMuted }]}>
                  {t("missions.summary.streak")}
                </Text>
                <Text style={[styles.statValue, { color: c.accent }]}>
                  {t("missions.summary.streakDays", { count: streakCount })}
                </Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: c.surface }]}>
                <Text style={[styles.statLabel, { color: c.textMuted }]}>
                  {t("missions.summary.totalXp")}
                </Text>
                <Text style={[styles.statValue, { color: c.accent }]}>
                  {dailyXpEarned} / {dailyXpTotal} XP
                </Text>
              </View>
            </View>
          </View>
          {streakItems.length > 0 ? (
            <View style={styles.streakWrap}>
              {streakItems.map((item, index) => (
                <View
                  key={`${item.type}-${index}`}
                  style={[styles.streakPill, { borderColor: `${c.accent}66` }]}
                >
                  <Text style={[styles.streakPillText, { color: c.accent }]}>
                    {item.type} ×{item.quantity}
                  </Text>
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
              <Text key={i} style={{ color: c.error, fontSize: typography.sm }}>
                {msg}
              </Text>
            ))}
          </GlassCard>
        ) : null}

        {missionsQuery.isPending ? (
          <Skeleton
            width="100%"
            height={100}
            style={{ marginBottom: spacing.md }}
          />
        ) : missionsQuery.isError ? (
          <ErrorState
            message={t("missions.errors.loadMissions")}
            onRetry={() => void missionsQuery.refetch()}
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
                      canSwap={canSwap}
                      onSwap={handleMissionSwap}
                      showSavingsMenu={showSavingsMenu}
                      onToggleSavingsMenu={() => setShowSavingsMenu((p) => !p)}
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
                <Text style={[styles.sectionTitle, { color: c.accent }]}>
                  {t("missions.weekly.title")}
                </Text>
                {weeklyMissions.map((m, index) => (
                  <AnimatedMissionCard
                    key={`weekly-${m.id}-${index}`}
                    index={index}
                  >
                    <MissionCard
                      mission={m}
                      isDaily={false}
                      t={t}
                      canSwap={canSwap}
                      onSwap={handleMissionSwap}
                      showSavingsMenu={showSavingsMenu}
                      onToggleSavingsMenu={() => setShowSavingsMenu((p) => !p)}
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
              <Text
                style={[
                  styles.sub,
                  { color: c.textMuted, marginBottom: spacing.lg },
                ]}
              >
                {t("missions.weekly.title")}: none available right now.
              </Text>
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
                    <Text style={[styles.wrapKicker, { color: c.textMuted }]}>
                      {t("missions.wrapup.title")}
                    </Text>
                    <Text style={[styles.wrapTitle, { color: c.accent }]}>
                      {t("missions.wrapup.earned", { xp: dailyXpEarned })}
                    </Text>
                    <Text style={[styles.wrapSub, { color: c.textMuted }]}>
                      {t("missions.wrapup.streakReview", {
                        count: streakCount,
                        days: streakCount,
                        review: reviewDue,
                      })}
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.wrapCta, { borderColor: `${c.accent}66` }]}
                >
                  <Text style={[styles.wrapCtaText, { color: c.accent }]}>
                    {t("missions.wrapup.cta")}
                  </Text>
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
    </>
  );
}

export default function MissionsTab() {
  return (
    <TabErrorBoundary>
      <MissionsInner />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.lg },
  title: { fontSize: typography.xl, fontWeight: "800" },
  sub: {
    fontSize: typography.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  tabChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
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
  summaryXp: { fontSize: typography.sm, marginTop: 4 },
  offline: {
    marginTop: spacing.sm,
    fontSize: typography.xs,
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
  statLabel: { fontSize: typography.xs, fontWeight: "700" },
  statValue: { fontSize: typography.sm, fontWeight: "800", marginTop: 4 },
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
  streakPillText: { fontSize: typography.xs, fontWeight: "700" },
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
  wrapSub: { fontSize: typography.sm, marginTop: spacing.xs, lineHeight: 20 },
  wrapCta: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  wrapCtaText: { fontSize: typography.sm, fontWeight: "600", lineHeight: 20 },
});
