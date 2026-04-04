import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { href } from "../../src/navigation/href";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deleteAccount,
  fetchProfile,
  fetchProgressSummary,
  queryKeys,
  staleTimes,
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

const SHOW_HEARTS_KEY = "monevo:show_hearts_ui";

function ProfileInner() {
  const colors = useThemeColors();
  const { clearSession } = useAuthSession();
  const [showHeartsUi, setShowHeartsUi] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const progressQuery = useQuery({
    queryKey: queryKeys.progressSummary(),
    queryFn: () => fetchProgressSummary().then((r) => r.data),
    staleTime: staleTimes.progressSummary,
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
    Alert.alert(
      "Delete account",
      "This permanently removes your account and progress. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteAccount();
                await clearSession();
                router.replace("/login");
              } catch {
                Alert.alert("Error", "Could not delete account.");
              }
            })();
          },
        },
      ]
    );
  }, [clearSession]);

  const onPushToggle = useCallback(
    async (next: boolean) => {
      setPushBusy(true);
      if (next) {
        const r = await registerForPushAndSubmitToken();
        setPushEnabled(r.ok);
        if (!r.ok) {
          Alert.alert("Notifications", r.message);
        }
      } else {
        setPushEnabled(false);
      }
      setPushBusy(false);
    },
    []
  );

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

  if (profileQuery.isError) {
    return (
      <View style={[styles.errorWrapper, { backgroundColor: colors.bg }]}>
        <ErrorState
          message="Could not load profile."
          onRetry={() => void profileQuery.refetch()}
        />
        <Button variant="ghost" onPress={() => void signOut()}>
          Sign out
        </Button>
      </View>
    );
  }

  const data = profileQuery.data;
  const username = data?.username ?? data?.user?.username ?? "—";
  const email = data?.email ?? data?.user?.email ?? "—";
  const displayName = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
  const streak = data?.streak ?? 0;
  const points = data?.points ?? 0;
  const lessonsDone = progressQuery.data?.completed_lessons ?? 0;

  return (
    <ScreenScroll
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
      refreshControl={
        <RefreshControl
          refreshing={profileQuery.isFetching || progressQuery.isFetching}
          onRefresh={() => {
            void profileQuery.refetch();
            void progressQuery.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={[styles.avatarRow, { marginBottom: spacing.xxl }]}>
        <Avatar username={displayName || username} size={64} />
        <View style={styles.nameCol}>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {displayName || username}
          </Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{email}</Text>
        </View>
      </View>

      <View
        style={[
          styles.statsRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <StatBox label="Streak" value={`${streak} 🔥`} colors={colors} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatBox label="Total XP" value={String(points)} colors={colors} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatBox label="Lessons" value={String(lessonsDone)} colors={colors} />
      </View>

      {data?.referral_code ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.surfaceOffset }}>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>Referral code</Text>
          <Text style={{ fontSize: typography.lg, fontWeight: "800", color: colors.accent }}>
            {data.referral_code}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: spacing.xs }}>
            Share Monevo with friends.
          </Text>
        </Card>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Menu</Text>
      <Card style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <MenuRow
          icon={navIcons.settings}
          label="Settings"
          onPress={() => router.push(href("/settings"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.billing}
          label="Billing"
          onPress={() => router.push(href("/billing"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.support}
          label="Support"
          onPress={() => router.push(href("/support"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.leaderboard}
          label="Leaderboard"
          onPress={() => router.push(href("/leaderboard"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.rewards}
          label="Rewards"
          onPress={() => router.push(href("/rewards"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.tools}
          label="Tools"
          onPress={() => router.push(href("/tools"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.chat}
          label="AI Tutor"
          onPress={() => router.push(href("/chat"))}
          colors={colors}
        />
        <MenuRow
          icon={navIcons.legal}
          label="Terms & policies"
          onPress={() => router.push(href("/legal/terms"))}
          colors={colors}
        />
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick toggles</Text>
      <Card style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <RowSwitch
          label="Show hearts bar (UI)"
          value={showHeartsUi}
          onValueChange={(v) => void persistShowHearts(v)}
          colors={colors}
        />
        <RowSwitch
          label="Push notifications"
          value={pushEnabled}
          disabled={pushBusy}
          onValueChange={(v) => void onPushToggle(v)}
          colors={colors}
        />
      </Card>

      <Card style={{ marginTop: spacing.lg, backgroundColor: colors.surface, borderColor: colors.border }}>
        <InfoRow label="Username" value={username} colors={colors} />
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <InfoRow label="Email" value={email} colors={colors} />
      </Card>

      <View style={styles.actions}>
        <Button variant="secondary" onPress={() => router.push("/change-password")}>
          Change password
        </Button>
        <Button variant="danger" onPress={() => void signOut()}>
          Sign out
        </Button>
        <Button variant="ghost" onPress={onDeleteAccount}>
          Delete account
        </Button>
      </View>
    </ScreenScroll>
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
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
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
  statsRow: {
    flexDirection: "row",
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xl,
  },
  statBox: { flex: 1, alignItems: "center" },
  statDivider: {
    width: StyleSheet.hairlineWidth,
  },
  statValue: {
    fontSize: typography.lg,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: typography.xs,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: "700",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  subheading: {
    fontSize: typography.xs,
    fontWeight: "700",
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
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
  },
  actions: { marginTop: spacing.xxxl, gap: spacing.md },
});
