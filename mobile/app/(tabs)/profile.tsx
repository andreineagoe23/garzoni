import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deleteAccount,
  fetchProfile,
  fetchProgressSummary,
  fetchUserSettings,
  patchUserSettings,
  queryKeys,
  staleTimes,
  SUPPORTED_LANGUAGES,
  i18n,
  normalizeLanguage,
} from "@monevo/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  Skeleton,
} from "../../src/components/ui";
import { TabErrorBoundary } from "../../src/components/common/TabErrorBoundary";
import { registerForPushAndSubmitToken } from "../../src/bootstrap/pushNotificationsMobile";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

const SHOW_HEARTS_KEY = "monevo:show_hearts_ui";

function ProfileInner() {
  const { clearSession } = useAuthSession();
  const queryClient = useQueryClient();
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

  const settingsQuery = useQuery({
    queryKey: queryKeys.userSettings(),
    queryFn: () => fetchUserSettings().then((r) => r.data),
    staleTime: staleTimes.profile,
  });

  const settingsMutation = useMutation({
    mutationFn: patchUserSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSettings() });
    },
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
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatarRow}>
          <Skeleton width={64} height={64} borderRadius={32} />
          <View style={{ marginLeft: spacing.lg, flex: 1 }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="80%" height={14} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
        <Skeleton width="100%" height={80} style={{ marginTop: spacing.xxl }} />
      </ScrollView>
    );
  }

  if (profileQuery.isError) {
    return (
      <View style={styles.errorWrapper}>
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

  const soundOn = settingsQuery.data?.sound_enabled !== false;
  const animOn = settingsQuery.data?.animations_enabled !== false;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={
            profileQuery.isFetching ||
            settingsQuery.isFetching ||
            progressQuery.isFetching
          }
          onRefresh={() => {
            void profileQuery.refetch();
            void settingsQuery.refetch();
            void progressQuery.refetch();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.avatarRow}>
        <Avatar username={displayName || username} size={64} />
        <View style={styles.nameCol}>
          <Text style={styles.displayName}>{displayName || username}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatBox label="Streak" value={`${streak} 🔥`} />
        <View style={styles.statDivider} />
        <StatBox label="Total XP" value={String(points)} />
        <View style={styles.statDivider} />
        <StatBox label="Lessons" value={String(lessonsDone)} />
      </View>

      <Text style={styles.sectionTitle}>Settings</Text>
      <Card>
        <Text style={styles.subheading}>Language</Text>
        {SUPPORTED_LANGUAGES.filter((l) => !("comingSoon" in l && l.comingSoon)).map(
          (lng) => {
            const active = normalizeLanguage(i18n.language) === lng.code;
            return (
              <Pressable
                key={lng.code}
                style={[styles.langRow, active && styles.langRowOn]}
                onPress={() => void i18n.changeLanguage(lng.code)}
              >
                <Text style={styles.langLabel}>{lng.label}</Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          }
        )}

        <View style={styles.separator} />

        <RowSwitch
          label="Sound effects"
          value={soundOn}
          onValueChange={(v) => settingsMutation.mutate({ sound_enabled: v })}
        />
        <RowSwitch
          label="Animations"
          value={animOn}
          onValueChange={(v) => settingsMutation.mutate({ animations_enabled: v })}
        />
        <RowSwitch
          label="Show hearts bar (UI)"
          value={showHeartsUi}
          onValueChange={(v) => void persistShowHearts(v)}
        />
        <RowSwitch
          label="Push notifications"
          value={pushEnabled}
          disabled={pushBusy}
          onValueChange={(v) => void onPushToggle(v)}
        />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <InfoRow label="Username" value={username} />
        <View style={styles.separator} />
        <InfoRow label="Email" value={email} />
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
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RowSwitch({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
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
    paddingBottom: 60,
    backgroundColor: colors.bg,
  },
  errorWrapper: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  nameCol: { marginLeft: spacing.lg, flex: 1 },
  displayName: {
    fontSize: typography.xl,
    fontWeight: "700",
    color: colors.text,
  },
  email: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  statBox: { flex: 1, alignItems: "center" },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: typography.lg,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: typography.md,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.md,
  },
  subheading: {
    fontSize: typography.xs,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  langRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langRowOn: { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
  langLabel: { fontSize: typography.base, color: colors.text },
  check: { color: colors.primary, fontWeight: "700" },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: typography.base, color: colors.text, flex: 1 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: typography.base,
    fontWeight: "600",
    color: colors.text,
  },
  actions: { marginTop: spacing.xxxl, gap: spacing.md },
});
