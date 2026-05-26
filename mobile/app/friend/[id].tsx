import { useLocalSearchParams, router, Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
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
  fetchPublicProfile,
  getMediaBaseUrl,
  queryKeys,
  respondToFriendRequest,
  sendFriendRequest,
  staleTimes,
  fetchIncomingFriendRequests,
  type PublicProfile,
  type PublicProfileBadge,
  type PublicProfileHeatmapDay,
  type PublicProfileSkill,
} from "@garzoni/core";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { ErrorState, Skeleton } from "../../src/components/ui";
import GlassCard from "../../src/components/ui/GlassCard";
import { spacing, typography, radius } from "../../src/theme/tokens";
import { leaderboardAvatarUri } from "../../src/components/leaderboard/leaderboardAvatarUri";

const CANONICAL_SKILLS = ["Budgeting", "Saving", "Investing", "Markets"] as const;

function resolveBadgeImage(image: string | null): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `${getMediaBaseUrl()}${image.startsWith("/") ? "" : "/"}${image}`;
}

function formatRelative(
  iso: string | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
  locale: string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return t("common.today", { defaultValue: "today" });
  if (diffMs < 2 * day) return t("common.yesterday", { defaultValue: "yesterday" });
  if (diffMs < 30 * day) {
    const days = Math.floor(diffMs / day);
    return t("common.daysAgo", { count: days, defaultValue: `${days} days ago` });
  }
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const c = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["publicProfile", userId],
    queryFn: () => fetchPublicProfile(userId).then((r) => r.data),
    enabled: Number.isFinite(userId) && userId > 0,
    staleTime: staleTimes.profile,
  });

  const incomingQuery = useQuery({
    queryKey: queryKeys.friendRequestsIncoming(),
    queryFn: () => fetchIncomingFriendRequests().then((r) => r.data),
    staleTime: 60_000,
  });

  const incomingFromTarget = useMemo(() => {
    const list = incomingQuery.data ?? [];
    return list.find(
      (r) => r.status === "pending" && r.sender?.id === userId,
    );
  }, [incomingQuery.data, userId]);

  const sendMut = useMutation({
    mutationFn: () => sendFriendRequest(userId),
    onSuccess: () => {
      Alert.alert("", t("friendProfile.friendRequestSent"));
      void queryClient.invalidateQueries({ queryKey: ["publicProfile", userId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsSent() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendsList() });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; detail?: string } } };
      Alert.alert(
        "",
        e?.response?.data?.error ||
          e?.response?.data?.detail ||
          t("friendProfile.errors.friendRequestFailed"),
      );
    },
  });

  const acceptMut = useMutation({
    mutationFn: (requestId: number) => respondToFriendRequest(requestId, "accept"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["publicProfile", userId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendsList() });
    },
  });

  const profile = profileQuery.data;
  const username = profile?.username ?? "";
  const avatarUri = leaderboardAvatarUri(profile?.profile_avatar ?? null) ?? null;

  return (
    <>
      <Stack.Screen
        options={{
          title: username || t("friendProfile.title"),
          headerShown: true,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={styles.content}
      >
        {profileQuery.isPending ? (
          <LoadingSkeleton />
        ) : profileQuery.isError || !profile ? (
          <ErrorState
            message={t("friendProfile.loadFailed")}
            onRetry={() => void profileQuery.refetch()}
          />
        ) : (
          <>
            <Hero
              profile={profile}
              avatarUri={avatarUri}
              relativeLastActive={formatRelative(
                profile.last_active_at,
                t,
                i18n.language,
              )}
              t={t}
            />

            <StatGrid profile={profile} t={t} locale={i18n.language} />

            {profile.vs_you && !profile.friendship.is_self ? (
              <VsYouCard profile={profile} t={t} locale={i18n.language} />
            ) : null}

            <SkillBars skills={profile.skills} t={t} />

            <BadgesStrip badges={profile.badges} count={profile.badges_count} t={t} />

            <ActivityHeatmap days={profile.activity_heatmap} t={t} />

            <ActionBar
              profile={profile}
              incomingRequestId={incomingFromTarget?.id ?? null}
              busySend={sendMut.isPending}
              busyAccept={acceptMut.isPending}
              onSend={() => sendMut.mutate()}
              onAccept={(rid) => acceptMut.mutate(rid)}
              onChallenge={() => {
                if (profile.open_duel) {
                  router.push(`/duels/${profile.open_duel.id}`);
                } else {
                  router.push(`/duels/new/${userId}`);
                }
              }}
              t={t}
            />
          </>
        )}
      </ScrollView>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <View style={{ alignItems: "center", paddingTop: spacing.xxxl }}>
      <Skeleton width={96} height={96} borderRadius={48} />
      <Skeleton
        width={180}
        height={22}
        borderRadius={radius.sm}
        style={{ marginTop: spacing.lg }}
      />
      <Skeleton
        width={120}
        height={14}
        borderRadius={radius.sm}
        style={{ marginTop: spacing.sm }}
      />
      <Skeleton
        width="100%"
        height={88}
        borderRadius={radius.lg}
        style={{ marginTop: spacing.xl }}
      />
      <Skeleton
        width="100%"
        height={140}
        borderRadius={radius.lg}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}

function Hero({
  profile,
  avatarUri,
  relativeLastActive,
  t,
}: {
  profile: PublicProfile;
  avatarUri: string | null;
  relativeLastActive: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const c = useThemeColors();
  return (
    <View style={styles.hero}>
      <View style={styles.avatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: c.surfaceOffset }]} />
        )}
        {profile.streak > 0 ? (
          <View style={[styles.streakBadge, { backgroundColor: c.accent }]}>
            <Text style={styles.streakBadgeText}>🔥 {profile.streak}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.username, { color: c.text }]} numberOfLines={1}>
        {profile.username}
      </Text>
      {relativeLastActive ? (
        <Text style={[styles.lastActive, { color: c.textMuted }]}>
          {t("friendProfile.lastActive", { date: relativeLastActive })}
        </Text>
      ) : null}
    </View>
  );
}

function StatGrid({
  profile,
  t,
  locale,
}: {
  profile: PublicProfile;
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
}) {
  const c = useThemeColors();
  const fmt = (n: number) => n.toLocaleString(locale);
  const cells = [
    {
      label: t("friendProfile.stats.rank"),
      value: profile.rank
        ? `#${fmt(profile.rank)}`
        : t("friendProfile.stats.noRank"),
    },
    { label: t("friendProfile.stats.xp"), value: fmt(profile.points) },
    {
      label: t("friendProfile.stats.lessons"),
      value: fmt(profile.lessons_completed),
    },
    {
      label: t("friendProfile.stats.missions"),
      value: fmt(profile.missions_completed),
    },
  ];
  return (
    <View style={styles.statGrid}>
      {cells.map((cell) => (
        <GlassCard
          key={cell.label}
          padding="md"
          style={[
            styles.statCell,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.statValue, { color: c.text }]}>{cell.value}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>
            {cell.label}
          </Text>
        </GlassCard>
      ))}
    </View>
  );
}

function VsYouCard({
  profile,
  t,
  locale,
}: {
  profile: PublicProfile;
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
}) {
  const c = useThemeColors();
  const v = profile.vs_you!;
  const fmt = (n: number) => Math.abs(n).toLocaleString(locale);

  const xpLine =
    v.xp_diff === 0
      ? t("friendProfile.vsYou.xpTied")
      : v.xp_diff > 0
        ? t("friendProfile.vsYou.xpAhead", { count: fmt(v.xp_diff) })
        : t("friendProfile.vsYou.xpBehind", { count: fmt(v.xp_diff) });

  const rankLine =
    v.rank_diff === null
      ? null
      : v.rank_diff === 0
        ? t("friendProfile.vsYou.ranksTied")
        : v.rank_diff > 0
          ? t("friendProfile.vsYou.ranksAhead", { count: fmt(v.rank_diff) })
          : t("friendProfile.vsYou.ranksBehind", { count: fmt(v.rank_diff) });

  const streakLine =
    v.streak_diff === 0
      ? t("friendProfile.vsYou.streakTied")
      : v.streak_diff > 0
        ? t("friendProfile.vsYou.streakAhead", { count: fmt(v.streak_diff) })
        : t("friendProfile.vsYou.streakBehind", { count: fmt(v.streak_diff) });

  return (
    <GlassCard
      padding="lg"
      style={[
        styles.section,
        { backgroundColor: `${c.accent}10`, borderColor: `${c.accent}55` },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("friendProfile.vsYou.title")}
      </Text>
      <Text style={[styles.vsLine, { color: c.text }]}>{xpLine}</Text>
      {rankLine ? (
        <Text style={[styles.vsLine, { color: c.text }]}>{rankLine}</Text>
      ) : null}
      <Text style={[styles.vsLine, { color: c.text }]}>{streakLine}</Text>
    </GlassCard>
  );
}

function SkillBars({
  skills,
  t,
}: {
  skills: PublicProfileSkill[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const c = useThemeColors();
  const ordered = useMemo(() => {
    const byName = new Map(skills.map((s) => [s.name, s]));
    const out: PublicProfileSkill[] = [];
    CANONICAL_SKILLS.forEach((name) => {
      out.push(byName.get(name) ?? { name, proficiency: 0 });
    });
    return out;
  }, [skills]);

  const hasAny = ordered.some((s) => s.proficiency > 0);

  return (
    <GlassCard
      padding="lg"
      style={[
        styles.section,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("friendProfile.skills.title")}
      </Text>
      {!hasAny ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          {t("friendProfile.skills.empty")}
        </Text>
      ) : (
        ordered.map((skill) => {
          const pct = Math.max(0, Math.min(100, skill.proficiency));
          return (
            <View key={skill.name} style={styles.skillRow}>
              <View style={styles.skillHeader}>
                <Text style={[styles.skillName, { color: c.text }]}>
                  {skill.name}
                </Text>
                <Text style={[styles.skillPct, { color: c.textMuted }]}>
                  {pct}%
                </Text>
              </View>
              <View
                style={[styles.skillTrack, { backgroundColor: c.surfaceOffset }]}
              >
                <View
                  style={[
                    styles.skillFill,
                    { width: `${pct}%`, backgroundColor: c.primary },
                  ]}
                />
              </View>
            </View>
          );
        })
      )}
    </GlassCard>
  );
}

function BadgesStrip({
  badges,
  count,
  t,
}: {
  badges: PublicProfileBadge[];
  count: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const c = useThemeColors();
  const extra = Math.max(0, count - badges.length);
  return (
    <GlassCard
      padding="lg"
      style={[
        styles.section,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("friendProfile.badges.title")}
      </Text>
      {badges.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          {t("friendProfile.badges.empty")}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.md }}
        >
          {badges.map((b) => {
            const img = resolveBadgeImage(b.image);
            return (
              <View key={b.id} style={styles.badgeItem}>
                {img ? (
                  <Image
                    source={{ uri: img }}
                    style={styles.badgeImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.badgeImage,
                      { backgroundColor: c.surfaceOffset },
                    ]}
                  />
                )}
                <Text
                  style={[styles.badgeName, { color: c.text }]}
                  numberOfLines={2}
                >
                  {b.name}
                </Text>
              </View>
            );
          })}
          {extra > 0 ? (
            <View style={styles.badgeItem}>
              <View
                style={[
                  styles.badgeImage,
                  { backgroundColor: c.surfaceOffset, alignItems: "center", justifyContent: "center" },
                ]}
              >
                <Text style={{ color: c.text, fontWeight: "800" }}>
                  +{extra}
                </Text>
              </View>
              <Text
                style={[styles.badgeName, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {t("friendProfile.badges.more", { count: extra })}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </GlassCard>
  );
}

function ActivityHeatmap({
  days,
  t,
}: {
  days: PublicProfileHeatmapDay[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const c = useThemeColors();
  const maxCount = useMemo(
    () => Math.max(1, ...days.map((d) => d.totalActivities)),
    [days],
  );
  const hasAny = days.some((d) => d.totalActivities > 0);
  return (
    <GlassCard
      padding="lg"
      style={[
        styles.section,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.text }]}>
        {t("friendProfile.activity.title")}
      </Text>
      {!hasAny ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          {t("friendProfile.activity.empty")}
        </Text>
      ) : (
        <View style={styles.heatGrid}>
          {days.map((d) => {
            const ratio = d.totalActivities / maxCount;
            const opacity = d.totalActivities === 0 ? 0.08 : 0.25 + ratio * 0.75;
            return (
              <View
                key={d.date}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor: c.primary,
                    opacity,
                  },
                ]}
              />
            );
          })}
        </View>
      )}
    </GlassCard>
  );
}

function ActionBar({
  profile,
  incomingRequestId,
  busySend,
  busyAccept,
  onSend,
  onAccept,
  onChallenge,
  t,
}: {
  profile: PublicProfile;
  incomingRequestId: number | null;
  busySend: boolean;
  busyAccept: boolean;
  onSend: () => void;
  onAccept: (requestId: number) => void;
  onChallenge: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const c = useThemeColors();
  const f = profile.friendship;
  if (f.is_self) return null;

  return (
    <View style={styles.actionBar}>
      {f.is_friend ? (
        <Pressable
          onPress={onChallenge}
          style={[styles.primaryBtn, { backgroundColor: c.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>
            ⚔{" "}
            {profile.open_duel
              ? t("duels.actions.view")
              : t("friendProfile.actions.challenge")}
          </Text>
        </Pressable>
      ) : null}

      {!f.is_friend && f.request_pending_incoming && incomingRequestId ? (
        <Pressable
          onPress={() => onAccept(incomingRequestId)}
          disabled={busyAccept}
          style={[
            styles.primaryBtn,
            { backgroundColor: c.primary, opacity: busyAccept ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.primaryBtnText, { color: c.textOnPrimary }]}>
            {t("friendProfile.actions.acceptIncoming")}
          </Text>
        </Pressable>
      ) : null}

      {!f.is_friend && !f.request_pending_incoming ? (
        <Pressable
          onPress={onSend}
          disabled={f.request_pending_outgoing || busySend}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: f.request_pending_outgoing
                ? c.surfaceOffset
                : c.primary,
              opacity: busySend ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.primaryBtnText,
              {
                color: f.request_pending_outgoing ? c.textMuted : c.textOnPrimary,
              },
            ]}
          >
            {f.request_pending_outgoing
              ? t("friendProfile.actions.pending")
              : t("friendProfile.actions.addFriend")}
          </Text>
        </Pressable>
      ) : null}

      {f.is_friend ? (
        <View
          style={[
            styles.friendBadgeRow,
            { backgroundColor: `${c.accent}18`, borderColor: `${c.accent}44` },
          ]}
        >
          <Text style={[styles.friendBadgeRowText, { color: c.accent }]}>
            ✓ {t("friendProfile.actions.alreadyFriends")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  avatarWrap: { position: "relative" },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  streakBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 36,
    alignItems: "center",
  },
  streakBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  username: {
    fontSize: typography.xl,
    fontWeight: "800",
    marginTop: spacing.lg,
    textAlign: "center",
    maxWidth: "100%",
  },
  lastActive: { fontSize: typography.sm, marginTop: 4 },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCell: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  statValue: { fontSize: typography.xl, fontWeight: "800" },
  statLabel: { fontSize: typography.xs, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  vsLine: {
    fontSize: typography.sm,
    fontWeight: "600",
    marginTop: 4,
  },
  empty: { fontSize: typography.sm },
  skillRow: { marginBottom: spacing.md },
  skillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  skillName: { fontSize: typography.sm, fontWeight: "700" },
  skillPct: { fontSize: typography.xs, fontWeight: "700" },
  skillTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  skillFill: { height: "100%", borderRadius: 999 },
  badgeItem: { width: 72, alignItems: "center" },
  badgeImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 6,
  },
  badgeName: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  heatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  heatCell: { width: 28, height: 28, borderRadius: 6 },
  actionBar: { marginTop: spacing.md, gap: spacing.md },
  primaryBtn: {
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryBtnText: { fontWeight: "800", fontSize: typography.base },
  friendBadgeRow: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  friendBadgeRowText: { fontWeight: "700", fontSize: typography.sm },
});
