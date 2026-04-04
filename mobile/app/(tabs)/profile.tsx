import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { href } from "../../src/navigation/href";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deleteAccount,
  fetchBadges,
  fetchEntitlements,
  fetchMissions,
  fetchProfile,
  fetchProgressSummary,
  fetchRecentActivity,
  fetchUserBadges,
  getMediaBaseUrl,
  queryKeys,
  staleTimes,
  type BadgeCatalogItem,
  type Entitlements,
  type RecentActivityItem,
  type UserBadgeItem,
} from "@monevo/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  ScreenScroll,
  Skeleton,
} from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { registerForPushAndSubmitToken } from "../../src/bootstrap/pushNotificationsMobile";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { navIcons } from "../../src/theme/navIcons";
import { Ionicons } from "@expo/vector-icons";
import { spacing, typography, radius } from "../../src/theme/tokens";
import type { ThemeColors } from "../../src/theme/palettes";
import EntitlementUsageMobile from "../../src/components/profile/EntitlementUsageMobile";
import ActivityCalendarMobile from "../../src/components/profile/ActivityCalendarMobile";
import { formatRelativeTime } from "../../src/utils/formatRelativeTime";

const SHOW_HEARTS_KEY = "monevo:show_hearts_ui";

type BadgeRow = {
  badge: BadgeCatalogItem;
  earned: boolean;
  earned_at: string | null;
};

function ProfileInner() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation("common");
  const { clearSession, accessToken } = useAuthSession();
  const [showHeartsUi, setShowHeartsUi] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [badgeFilter, setBadgeFilter] = useState<"all" | "earned" | "locked">("all");

  const enabled = Boolean(accessToken);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
    enabled,
  });

  const progressQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () => fetchProgressSummary().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
    enabled,
  });

  const entitlementsQuery = useQuery({
    queryKey: queryKeys.entitlements(),
    queryFn: () => fetchEntitlements().then((r) => r.data as Entitlements),
    staleTime: staleTimes.entitlements,
    enabled,
  });

  const missionsQuery = useQuery({
    queryKey: queryKeys.missions(),
    queryFn: () => fetchMissions().then((r) => r.data),
    staleTime: 30_000,
    enabled,
  });

  const recentActivityQuery = useQuery({
    queryKey: queryKeys.recentActivity(),
    queryFn: () =>
      fetchRecentActivity().then((r) => r.data?.recent_activities ?? []),
    staleTime: 60_000,
    enabled,
  });

  const badgesCatalogQuery = useQuery({
    queryKey: queryKeys.badgesCatalog(),
    queryFn: () => fetchBadges().then((r) => r.data ?? []),
    staleTime: 10 * 60_000,
    enabled,
  });

  const userBadgesQuery = useQuery({
    queryKey: queryKeys.userBadges(),
    queryFn: () => fetchUserBadges().then((r) => r.data ?? []),
    staleTime: 60_000,
    enabled,
  });

  useEffect(() => {
    void AsyncStorage.getItem(SHOW_HEARTS_KEY).then((v) => {
      if (v === "0") setShowHeartsUi(false);
    });
  }, []);

  const persistShowHearts = useCallback(async (next: boolean) => {
    setShowHeartsUi(next);
    await AsyncStorage.setItem(SHOW_HEARTS_KEY, next ? "1" : "0");
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    router.replace("/login");
  }, [clearSession]);

  const onDeleteAccount = useCallback(() => {
    Alert.alert(t("profile.deleteConfirmTitle"), t("profile.deleteConfirmBody"), [
      { text: t("settings.actions.cancel"), style: "cancel" },
      {
        text: t("profile.deleteAction"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await deleteAccount();
              await clearSession();
              router.replace("/login");
            } catch {
              Alert.alert(t("settings.errors.deleteAccount"), t("profile.deleteError"));
            }
          })();
        },
      },
    ]);
  }, [clearSession, t]);

  const onPushToggle = useCallback(
    async (next: boolean) => {
      setPushBusy(true);
      if (next) {
        const r = await registerForPushAndSubmitToken();
        setPushEnabled(r.ok);
        if (!r.ok) {
          Alert.alert(t("profile.notificationsTitle"), r.message);
        }
      } else {
        setPushEnabled(false);
      }
      setPushBusy(false);
    },
    [t]
  );

  const merged = useMemo(() => {
    const p = profileQuery.data;
    if (!p) return null;
    const ud = p.user_data as Record<string, unknown> | undefined;
    if (ud && typeof ud === "object") {
      return { ...p, ...ud } as typeof p & Record<string, unknown>;
    }
    return p;
  }, [profileQuery.data]);

  const entitlementUsage = useMemo(() => {
    const features = entitlementsQuery.data?.features || {};
    return Object.values(features)
      .map((feature) => ({
        key: feature.flag || feature.name || "",
        name: feature.name,
        enabled: feature.enabled,
        used: feature.used_today,
        remaining: feature.remaining_today,
      }))
      .filter((feature) => feature.name && feature.enabled !== false);
  }, [entitlementsQuery.data?.features]);

  const badgesMerged: BadgeRow[] = useMemo(() => {
    const catalog = badgesCatalogQuery.data ?? [];
    const earnedList = userBadgesQuery.data ?? [];
    const earnedMap: Record<number, UserBadgeItem> = {};
    earnedList.forEach((ub) => {
      earnedMap[ub.badge.id] = ub;
    });
    return catalog.map((badge) => {
      const userBadge = earnedMap[badge.id];
      return {
        badge,
        earned: Boolean(userBadge),
        earned_at: userBadge ? userBadge.earned_at : null,
      };
    });
  }, [badgesCatalogQuery.data, userBadgesQuery.data]);

  const filteredBadges = useMemo(() => {
    if (badgeFilter === "earned") return badgesMerged.filter((b) => b.earned);
    if (badgeFilter === "locked") return badgesMerged.filter((b) => !b.earned);
    return badgesMerged;
  }, [badgesMerged, badgeFilter]);

  const weekdayLabels = useMemo(
    () => [
      t("profile.weekdays.sun"),
      t("profile.weekdays.mon"),
      t("profile.weekdays.tue"),
      t("profile.weekdays.wed"),
      t("profile.weekdays.thu"),
      t("profile.weekdays.fri"),
      t("profile.weekdays.sat"),
    ],
    [t]
  );

  const goals = useMemo(() => {
    const dailyLessonMission = missionsQuery.data?.daily_missions?.find(
      (m) => m.goal_type === "complete_lesson"
    );
    const dailyCurrent = dailyLessonMission ? Math.round(dailyLessonMission.progress ?? 0) : 0;
    const pts = typeof merged?.points === "number" ? merged.points : 0;
    const weeklyTarget = 500;
    return {
      daily: {
        label: t("profile.goals.dailyLabel"),
        current: dailyCurrent,
        target: 1,
        completed: dailyLessonMission?.status === "completed",
      },
      weekly: {
        label: t("profile.goals.weeklyLabel"),
        current: pts,
        target: weeklyTarget,
        completed: pts >= weeklyTarget,
      },
    };
  }, [missionsQuery.data?.daily_missions, merged?.points, t]);

  const onRefresh = useCallback(() => {
    void profileQuery.refetch();
    void progressQuery.refetch();
    void entitlementsQuery.refetch();
    void missionsQuery.refetch();
    void recentActivityQuery.refetch();
    void badgesCatalogQuery.refetch();
    void userBadgesQuery.refetch();
  }, [
    profileQuery,
    progressQuery,
    entitlementsQuery,
    missionsQuery,
    recentActivityQuery,
    badgesCatalogQuery,
    userBadgesQuery,
  ]);

  const refreshing =
    profileQuery.isFetching ||
    progressQuery.isFetching ||
    entitlementsQuery.isFetching ||
    missionsQuery.isFetching ||
    recentActivityQuery.isFetching ||
    badgesCatalogQuery.isFetching ||
    userBadgesQuery.isFetching;

  if (!enabled) {
    return (
      <ScreenScroll contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.textMuted }}>{t("auth.login.subtitle")}</Text>
      </ScreenScroll>
    );
  }

  if (profileQuery.isPending) {
    return (
      <ScreenScroll contentContainerStyle={styles.container}>
        <View style={styles.avatarRow}>
          <Skeleton width={64} height={64} borderRadius={32} />
          <View style={{ marginLeft: spacing.lg, flex: 1 }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="80%" height={14} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
        <Skeleton width="100%" height={80} style={{ marginTop: spacing.xxl }} />
      </ScreenScroll>
    );
  }

  if (profileQuery.isError || !merged) {
    return (
      <View style={[styles.errorWrapper, { backgroundColor: colors.bg }]}>
        <ErrorState message={t("profile.couldNotLoad")} onRetry={() => void profileQuery.refetch()} />
        <Button variant="ghost" onPress={() => void signOut()}>
          {t("widgets.userProgress.logout")}
        </Button>
      </View>
    );
  }

  const username =
    merged.username ?? (merged.user as { username?: string } | undefined)?.username ?? "—";
  const email = merged.email ?? (merged.user as { email?: string } | undefined)?.email ?? "—";
  const displayName = [merged.first_name, merged.last_name].filter(Boolean).join(" ");
  const streak = merged.streak ?? 0;
  const points = merged.points ?? 0;
  const lessonsDone = progressQuery.data?.completed_lessons ?? 0;
  const earnedMoney = Number(merged.earned_money ?? 0);

  const rawAvatar =
    (merged.profile_avatar_url as string | undefined) ||
    (merged.avatar_url as string | undefined) ||
    (merged.user as { profile_avatar_url?: string } | undefined)?.profile_avatar_url ||
    (merged.profile_avatar as string | undefined) ||
    "";
  const avatarUri = rawAvatar
    ? /^https?:\/\//i.test(rawAvatar)
      ? rawAvatar
      : `${getMediaBaseUrl()}${rawAvatar.startsWith("/") ? "" : "/"}${rawAvatar}`
    : null;

  const activityCalendar = (merged.activity_calendar as Record<string, unknown>) || {};
  const currentMonth = (merged.current_month as {
    first_day?: string | number | Date | null;
    last_day?: string | number | Date | null;
    month_name?: string;
    year?: number | string | null;
  }) || { first_day: null, last_day: null, month_name: "", year: null };

  const entitlements = entitlementsQuery.data;
  const subActive = ["active", "trialing"].includes(String(entitlements?.status ?? ""));

  const recentActivities = recentActivityQuery.data ?? [];
  const activityVisible = showAllActivity ? recentActivities : recentActivities.slice(0, 3);
  const visibleBadgeLimit = 6;
  const badgesToShow = showAllBadges
    ? filteredBadges
    : filteredBadges.slice(0, visibleBadgeLimit);

  const mediaBase = getMediaBaseUrl();

  return (
    <ScreenScroll
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={[styles.avatarRow, { marginBottom: spacing.lg }]}>
        <Avatar username={displayName || username} uri={avatarUri} size={64} />
        <View style={styles.nameCol}>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {displayName || username || t("profile.fallbackUser")}
          </Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{email}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Button
          variant="secondary"
          onPress={() => router.push(href("/personalized-path"))}
          style={styles.actionBtn}
        >
          {t("profile.actions.personalizedPath")}
        </Button>
        <Button
          variant="secondary"
          onPress={() =>
            router.push(
              href(subActive ? "/billing" : "/subscriptions")
            )
          }
          style={styles.actionBtn}
        >
          {subActive ? t("billing.manageSubscription") : t("profile.actions.subscription")}
        </Button>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("profile.goals.title")}</Text>
      <Text style={[styles.sectionSub, { color: colors.textMuted, marginBottom: spacing.md }]}>
        {t("profile.goals.subtitle")}
      </Text>
      <GoalCard colors={colors} goalKey="daily" goal={goals.daily} t={t} />
      <GoalCard colors={colors} goalKey="weekly" goal={goals.weekly} t={t} />

      <EntitlementUsageMobile items={entitlementUsage} colors={colors} />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("profile.streak.title")}</Text>
      <Text style={[styles.sectionSub, { color: colors.textMuted, marginBottom: spacing.sm }]}>
        {t("profile.streak.subtitle")}
      </Text>
      <ActivityCalendarMobile
        currentMonth={currentMonth}
        activityCalendar={activityCalendar}
        weekdayLabels={weekdayLabels}
        colors={colors}
      />

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("profile.stats.title")}</Text>
      <View
        style={[
          styles.statsGrid,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.statsRowPair}>
          <StatBox
            label={t("profile.stats.balance")}
            value={earnedMoney.toLocaleString(i18n.language)}
            colors={colors}
          />
          <StatBox label={t("profile.stats.points")} value={String(points)} colors={colors} />
        </View>
        <View style={styles.statsRowPair}>
          <StatBox label={t("profile.stats.streak")} value={`${streak} 🔥`} colors={colors} />
          <StatBox label={t("profile.stats.lessonsShort")} value={String(lessonsDone)} colors={colors} />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t("profile.achievements.title")}
      </Text>
      <View style={styles.chipRow}>
        {(
          [
            ["all", t("profile.achievements.filterAll")],
            ["earned", t("profile.achievements.filterEarned")],
            ["locked", t("profile.achievements.filterLocked")],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setBadgeFilter(key)}
            style={[
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor: badgeFilter === key ? colors.primary + "22" : colors.surfaceOffset,
              },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: typography.xs, fontWeight: "600" }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {badgesCatalogQuery.isError ? (
        <Text style={{ color: colors.textMuted, marginBottom: spacing.md }}>
          {t("profile.couldNotLoad")}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {badgesToShow.map((row) => {
            const src = row.badge.image_url
              ? /^https?:\/\//i.test(row.badge.image_url)
                ? row.badge.image_url
                : `${mediaBase}${row.badge.image_url.startsWith("/") ? "" : "/"}${row.badge.image_url}`
              : null;
            return (
              <View
                key={row.badge.id}
                style={[
                  styles.badgeCell,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceOffset,
                    opacity: row.earned ? 1 : 0.45,
                  },
                ]}
              >
                {src ? (
                  <Image source={{ uri: src }} style={styles.badgeImg} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[styles.badgeImg, { backgroundColor: colors.border }]} />
                )}
                <Text numberOfLines={2} style={[styles.badgeName, { color: colors.text }]}>
                  {row.badge.name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
      {filteredBadges.length > visibleBadgeLimit ? (
        <Pressable onPress={() => setShowAllBadges((v) => !v)}>
          <Text style={{ color: colors.primary, fontWeight: "600", marginBottom: spacing.lg }}>
            {showAllBadges ? t("profile.achievements.showLess") : t("profile.achievements.showAll")}
          </Text>
        </Pressable>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("profile.activity.title")}</Text>
      {recentActivityQuery.isPending ? (
        <Skeleton width="100%" height={48} style={{ marginBottom: spacing.sm }} />
      ) : recentActivities.length === 0 ? (
        <Text style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
          {t("profile.activity.empty")}
        </Text>
      ) : (
        <>
          {activityVisible.map((activity: RecentActivityItem, idx: number) => {
            const title = String(activity.title || activity.name || "");
            const ts = activity.timestamp ? formatRelativeTime(activity.timestamp, i18n.language) : "";
            return (
              <Card
                key={`${activity.type}-${activity.timestamp}-${idx}`}
                style={{
                  marginBottom: spacing.sm,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>{title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: 4 }}>
                  {activity.action} {ts ? `· ${ts}` : ""}
                  {activity.course ? ` · ${activity.course}` : ""}
                </Text>
              </Card>
            );
          })}
          {recentActivities.length > 3 ? (
            <Pressable onPress={() => setShowAllActivity((v) => !v)}>
              <Text style={{ color: colors.primary, fontWeight: "600", marginBottom: spacing.lg }}>
                {showAllActivity ? t("profile.achievements.showLess") : t("profile.achievements.showAll")}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}

      {merged.referral_code ? (
        <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.surfaceOffset }}>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            {t("profile.referral.title")}
          </Text>
          <Text style={{ fontSize: typography.lg, fontWeight: "800", color: colors.accent }}>
            {String(merged.referral_code)}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: spacing.xs }}>
            {t("profile.referral.subtitle")}
          </Text>
        </Card>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t("profile.menuSection")}</Text>
      <Card style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <MenuRow
          icon={navIcons.settings}
          label={t("nav.settings")}
          onPress={() => router.push(href("/settings"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.billing}
          label={t("profile.plansMenu")}
          onPress={() => router.push(href("/subscriptions"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.billing}
          label={t("billing.subscriptionManagement")}
          onPress={() => router.push(href("/billing"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.support}
          label={t("footer.support")}
          onPress={() => router.push(href("/support"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.leaderboard}
          label={t("footer.leaderboards")}
          onPress={() => router.push(href("/leaderboard"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.rewards}
          label={t("footer.rewards")}
          onPress={() => router.push(href("/rewards"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.tools}
          label={t("footer.tools")}
          onPress={() => router.push(href("/tools"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.chat}
          label={t("chatbot.title")}
          onPress={() => router.push(href("/chat"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.legal}
          label={t("footer.termsConditions")}
          onPress={() => router.push(href("/legal/terms"))}
          colors={colors}
        />
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t("profile.quickTogglesSection")}
      </Text>
      <Card style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <RowSwitch
          label={t("profile.heartsUi")}
          value={showHeartsUi}
          onValueChange={(v) => void persistShowHearts(v)}
          colors={colors}
        />
        <RowSwitch
          label={t("profile.pushNotifications")}
          value={pushEnabled}
          disabled={pushBusy}
          onValueChange={(v) => void onPushToggle(v)}
          colors={colors}
        />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: colors.surface, borderColor: colors.border }}>
        <InfoRow label={t("auth.register.username")} value={username} colors={colors} />
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <InfoRow label={t("auth.register.email")} value={email} colors={colors} />
      </Card>

      <View style={styles.actions}>
        <Button variant="secondary" onPress={() => router.push("/change-password")}>
          {t("settings.password.title")}
        </Button>
        <Button variant="danger" onPress={() => void signOut()}>
          {t("widgets.userProgress.logout")}
        </Button>
        <Button variant="ghost" onPress={onDeleteAccount}>
          {t("settings.danger.deleteAccount")}
        </Button>
      </View>
    </ScreenScroll>
  );
}

function GoalCard({
  colors,
  goalKey,
  goal,
  t,
}: {
  colors: ThemeColors;
  goalKey: "daily" | "weekly";
  goal: { label: string; current: number; target: number; completed: boolean };
  t: (k: string) => string;
}) {
  const pct = Math.min(100, (goal.current / Math.max(goal.target, 1)) * 100);
  return (
    <Card
      style={{
        marginBottom: spacing.md,
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: typography.sm }}>
        {goalKey === "daily" ? t("profile.goals.dailyTitle") : t("profile.goals.weeklyTitle")}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: 4 }}>{goal.label}</Text>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: spacing.sm }}>
        {Math.min(goal.current, goal.target)} / {goal.target}
        {goal.completed ? ` ${t("profile.goals.completed")}` : ""}
      </Text>
    </Card>
  );
}

function StatBox({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function RowSwitch({
  label,
  value,
  onValueChange,
  disabled,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        {
          borderBottomColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.primary} />
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  return (
    <TabErrorBoundary>
      <ProfileInner />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  errorWrapper: {
    flex: 1,
    padding: spacing.xl,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameCol: { marginLeft: spacing.lg, flex: 1 },
  displayName: {
    fontSize: typography.xl,
    fontWeight: "700",
  },
  email: {
    fontSize: typography.sm,
    marginTop: 2,
  },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  actionBtn: { flex: 1, minWidth: 140 },
  statsGrid: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  statsRowPair: { flexDirection: "row", gap: spacing.md },
  statBox: { flex: 1, alignItems: "center", paddingVertical: spacing.xs },
  statValue: {
    fontSize: typography.sm,
    fontWeight: "700",
    textAlign: "center",
  },
  statLabel: {
    fontSize: 9,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionSub: { fontSize: typography.sm },
  subheading: {
    fontSize: typography.xs,
    fontWeight: "700",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeCell: {
    width: 88,
    marginRight: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    alignItems: "center",
  },
  badgeImg: { width: 48, height: 48, borderRadius: 8 },
  badgeName: { fontSize: 10, marginTop: 4, textAlign: "center" },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: typography.base, flex: 1 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { flex: 1, fontSize: typography.base, fontWeight: "600" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: typography.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: typography.base,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  actions: { marginTop: spacing.xxxl, gap: spacing.md },
});
