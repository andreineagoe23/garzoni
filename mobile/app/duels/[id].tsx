import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  cancelDuel,
  fetchDuelDetail,
  finalizeDuel,
  queryKeys,
  respondToDuel,
  type DuelRecord,
} from "@garzoni/core";
import { useThemeColors } from "../../src/theme/ThemeContext";
import GlassCard from "../../src/components/ui/GlassCard";
import { ErrorState, Skeleton } from "../../src/components/ui";
import { spacing, typography, radius } from "../../src/theme/tokens";
import { useScreenGutter } from "../../src/utils/platform";
import { leaderboardAvatarUri } from "../../src/components/leaderboard/leaderboardAvatarUri";
import {
  formatCountdown,
  formatPast,
} from "../../src/components/duels/duelTime";

export default function DuelDetailScreen() {
  const gutter = useScreenGutter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const duelId = Number(id);
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();

  const [tick, setTick] = useState(0);

  const duelQuery = useQuery({
    queryKey: queryKeys.duelDetail(duelId),
    queryFn: () => fetchDuelDetail(duelId).then((r) => r.data),
    enabled: Number.isFinite(duelId) && duelId > 0,
    staleTime: 15_000,
    refetchInterval: (q) =>
      q.state.data?.status === "active" ? 20_000 : false,
  });

  const duel = duelQuery.data;

  const respondMut = useMutation({
    mutationFn: (action: "accept" | "decline") => respondToDuel(duelId, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.duelDetail(duelId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.duelsActive() });
    },
    onError: () => Alert.alert("", t("duels.errors.respondFailed")),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelDuel(duelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.duelDetail(duelId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.duelsActive() });
      router.back();
    },
    onError: () => Alert.alert("", t("duels.errors.cancelFailed")),
  });

  const finalizeMut = useMutation({
    mutationFn: () => finalizeDuel(duelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.duelDetail(duelId),
      });
    },
  });

  // Drive countdown re-render every 30s while active
  useEffect(() => {
    if (duel?.status !== "active") return;
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, [duel?.status]);

  // Auto-trigger finalize once ends_at has passed and still marked active
  useEffect(() => {
    if (duel?.status !== "active" || !duel.ends_at) return;
    const now = Date.now();
    const end = new Date(duel.ends_at).getTime();
    if (end <= now) {
      finalizeMut.mutate();
    }
    // tick is in deps so this re-checks on every countdown re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.status, duel?.ends_at, tick]);

  const sides = useMemo(() => {
    if (!duel) return null;
    const youAreChallenger = duel.viewer_role === "challenger";
    return {
      self: youAreChallenger ? duel.challenger : duel.opponent,
      other: youAreChallenger ? duel.opponent : duel.challenger,
      youAreChallenger,
    };
  }, [duel]);

  return (
    <>
      <Stack.Screen options={{ title: t("duels.title"), headerShown: true }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.xl + gutter },
        ]}
      >
        {duelQuery.isPending ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton width="100%" height={140} borderRadius={radius.lg} />
            <Skeleton width="100%" height={80} borderRadius={radius.lg} />
          </View>
        ) : duelQuery.isError || !duel || !sides ? (
          <ErrorState
            message={t("duels.errors.loadFailed")}
            onRetry={() => void duelQuery.refetch()}
          />
        ) : (
          <>
            <ScoreboardCard
              duel={duel}
              sides={sides}
              t={t}
              locale={i18n.language}
            />

            <StatusCard
              duel={duel}
              sides={sides}
              t={t}
              locale={i18n.language}
            />

            {duel.status === "pending" && duel.viewer_role === "opponent" ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => respondMut.mutate("accept")}
                  disabled={respondMut.isPending}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: c.primary,
                      flex: 1,
                      opacity: respondMut.isPending ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.primaryBtnText, { color: c.textOnPrimary }]}
                  >
                    {t("duels.actions.accept")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => respondMut.mutate("decline")}
                  disabled={respondMut.isPending}
                  style={[
                    styles.secondaryBtn,
                    { borderColor: c.border, flex: 1 },
                  ]}
                >
                  <Text
                    style={[styles.secondaryBtnText, { color: c.textMuted }]}
                  >
                    {t("duels.actions.decline")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {duel.status === "pending" && duel.viewer_role === "challenger" ? (
              <Pressable
                onPress={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
                style={[
                  styles.secondaryBtn,
                  {
                    borderColor: c.border,
                    marginTop: spacing.md,
                    opacity: cancelMut.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: c.textMuted }]}>
                  {t("duels.actions.cancel")}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

function ScoreboardCard({
  duel,
  sides,
  t,
  locale,
}: {
  duel: DuelRecord;
  sides: {
    self: DuelRecord["challenger"];
    other: DuelRecord["challenger"];
    youAreChallenger: boolean;
  };
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
}) {
  const c = useThemeColors();
  const total = Math.max(1, sides.self.xp_delta + sides.other.xp_delta);
  const selfPct = (sides.self.xp_delta / total) * 100;
  const selfAvatar = leaderboardAvatarUri(sides.self.profile_avatar ?? null);
  const otherAvatar = leaderboardAvatarUri(sides.other.profile_avatar ?? null);
  return (
    <GlassCard
      padding="lg"
      style={[
        styles.section,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={styles.scoreboardRow}>
        <View style={styles.sideCol}>
          {selfAvatar ? (
            <Image source={{ uri: selfAvatar }} style={styles.bigAvatar} />
          ) : (
            <View
              style={[styles.bigAvatar, { backgroundColor: c.surfaceOffset }]}
            />
          )}
          <Text style={[styles.sideName, { color: c.text }]} numberOfLines={1}>
            {t("duels.detail.yourScore")}
          </Text>
          <Text style={[styles.sideXp, { color: c.primary }]}>
            {sides.self.xp_delta.toLocaleString(locale)} XP
          </Text>
        </View>
        <Text style={[styles.bigVs, { color: c.textFaint }]}>vs</Text>
        <View style={styles.sideCol}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.bigAvatar} />
          ) : (
            <View
              style={[styles.bigAvatar, { backgroundColor: c.surfaceOffset }]}
            />
          )}
          <Text style={[styles.sideName, { color: c.text }]} numberOfLines={1}>
            {sides.other.username}
          </Text>
          <Text style={[styles.sideXp, { color: c.accent }]}>
            {sides.other.xp_delta.toLocaleString(locale)} XP
          </Text>
        </View>
      </View>
      <View
        style={[styles.progressTrack, { backgroundColor: c.surfaceOffset }]}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${selfPct}%`, backgroundColor: c.primary },
          ]}
        />
      </View>
    </GlassCard>
  );
}

function StatusCard({
  duel,
  sides,
  t,
  locale,
}: {
  duel: DuelRecord;
  sides: { self: DuelRecord["challenger"]; other: DuelRecord["challenger"] };
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
}) {
  const c = useThemeColors();

  let title = "";
  let body = "";

  if (duel.status === "active") {
    title = t("duels.detail.countdown", {
      time: formatCountdown(duel.ends_at, t),
    });
    const diff = sides.self.xp_delta - sides.other.xp_delta;
    if (diff > 0)
      body = t("duels.card.leadingBy", { xp: diff.toLocaleString(locale) });
    else if (diff < 0)
      body = t("duels.card.behindBy", {
        xp: Math.abs(diff).toLocaleString(locale),
      });
    else body = t("duels.card.tied");
  } else if (duel.status === "pending") {
    title = t(`duels.status.pending`);
    body =
      duel.viewer_role === "challenger"
        ? t("duels.card.outgoing", { username: sides.other.username })
        : t("duels.card.incoming", { username: sides.other.username });
  } else if (
    duel.status === "won_by_challenger" ||
    duel.status === "won_by_opponent"
  ) {
    const youWon =
      (duel.status === "won_by_challenger" &&
        duel.viewer_role === "challenger") ||
      (duel.status === "won_by_opponent" && duel.viewer_role === "opponent");
    title = youWon
      ? t("duels.detail.winnerYou")
      : t("duels.detail.winnerThem", { username: sides.other.username });
    body = t("duels.detail.finishedAt", {
      when: formatPast(duel.finished_at, locale),
    });
  } else if (duel.status === "draw") {
    title = t("duels.detail.drawResult");
    body = t("duels.detail.finishedAt", {
      when: formatPast(duel.finished_at, locale),
    });
  } else {
    title = t(`duels.status.${duel.status}`);
    body = t("duels.detail.finishedAt", {
      when: formatPast(duel.finished_at, locale),
    });
  }

  return (
    <GlassCard
      padding="lg"
      style={[
        styles.section,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[styles.statusTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.statusBody, { color: c.textMuted }]}>{body}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  section: { borderWidth: StyleSheet.hairlineWidth },
  scoreboardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sideCol: { flex: 1, alignItems: "center" },
  bigAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: spacing.sm,
  },
  sideName: {
    fontSize: typography.sm,
    fontWeight: "700",
    maxWidth: "100%",
  },
  sideXp: { fontSize: typography.xl, fontWeight: "800", marginTop: 4 },
  bigVs: { fontSize: typography.xl, fontWeight: "800" },
  progressTrack: { height: 10, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  statusTitle: { fontSize: typography.lg, fontWeight: "800" },
  statusBody: { fontSize: typography.sm, marginTop: 4 },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  primaryBtn: {
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryBtnText: { fontWeight: "800", fontSize: typography.base },
  secondaryBtn: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  secondaryBtnText: { fontWeight: "700", fontSize: typography.sm },
});
