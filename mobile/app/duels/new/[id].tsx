import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import {
  createDuel,
  DUEL_DURATION_BONUS,
  fetchPublicProfile,
  queryKeys,
  staleTimes,
  type DuelDuration,
} from "@garzoni/core";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import GlassCard from "../../../src/components/ui/GlassCard";
import { Skeleton } from "../../../src/components/ui";
import { layout, radius, spacing, typography } from "../../../src/theme/tokens";
import { useScreenGutter } from "../../../src/utils/platform";
import { leaderboardAvatarUri } from "../../../src/components/leaderboard/leaderboardAvatarUri";

const DURATIONS: DuelDuration[] = [24, 72, 168];

export default function NewDuelScreen() {
  const gutter = useScreenGutter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const opponentId = Number(id);
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const [duration, setDuration] = useState<DuelDuration>(72);

  const profileQuery = useQuery({
    queryKey: ["publicProfile", opponentId],
    queryFn: () => fetchPublicProfile(opponentId).then((r) => r.data),
    enabled: Number.isFinite(opponentId) && opponentId > 0,
    staleTime: staleTimes.profile,
  });

  const createMut = useMutation({
    mutationFn: () => createDuel(opponentId, duration),
    onSuccess: (r) => {
      Alert.alert("", t("duels.challenge.sent"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.duelsActive() });
      router.replace(`/duels/${r.data.id}`);
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: {
          data?: { error?: string; code?: string; detail?: string };
        };
      };
      const code = e?.response?.data?.code;
      let message = e?.response?.data?.error || e?.response?.data?.detail;
      if (code === "max_active") message = t("duels.challenge.maxActive");
      else if (code === "pair_cooldown")
        message = t("duels.challenge.cooldown");
      Alert.alert("", message || t("duels.challenge.failed"));
    },
  });

  const profile = profileQuery.data;
  const username = profile?.username ?? "";
  const avatarUri = leaderboardAvatarUri(profile?.profile_avatar ?? null);

  const durationLabel = (d: DuelDuration) =>
    d === 24
      ? t("duels.challenge.duration24h")
      : d === 72
        ? t("duels.challenge.duration3d")
        : t("duels.challenge.duration7d");

  return (
    <>
      <Stack.Screen
        options={{
          title: t("duels.challenge.title", { username }),
          headerShown: true,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.screenPaddingX + gutter },
        ]}
      >
        {profileQuery.isPending ? (
          <View style={{ alignItems: "center" }}>
            <Skeleton width={88} height={88} borderRadius={44} />
            <Skeleton
              width={160}
              height={22}
              borderRadius={radius.sm}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : profile ? (
          <View style={styles.header}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View
                style={[styles.avatar, { backgroundColor: c.surfaceOffset }]}
              />
            )}
            <Text style={[styles.username, { color: c.text }]}>
              {profile.username}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {t("duels.challenge.subtitle")}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.label, { color: c.text }]}>
          {t("duels.challenge.duration")}
        </Text>
        <View style={styles.durationGrid}>
          {DURATIONS.map((d) => {
            const selected = duration === d;
            return (
              <Pressable
                key={d}
                onPress={() => setDuration(d)}
                style={[
                  styles.durationBtn,
                  {
                    borderColor: selected ? c.primary : c.border,
                    backgroundColor: selected ? `${c.primary}18` : c.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.durationLabel,
                    { color: selected ? c.primary : c.text },
                  ]}
                >
                  {durationLabel(d)}
                </Text>
                <Text style={[styles.durationXp, { color: c.textMuted }]}>
                  {t("duels.challenge.reward", { xp: DUEL_DURATION_BONUS[d] })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <GlassCard
          padding="md"
          style={[
            styles.rewardCard,
            { backgroundColor: `${c.accent}10`, borderColor: `${c.accent}55` },
          ]}
        >
          <Text style={[styles.rewardLabel, { color: c.textMuted }]}>
            {t("duels.challenge.rewardLabel")}
          </Text>
          <Text style={[styles.rewardValue, { color: c.accent }]}>
            {t("duels.challenge.reward", { xp: DUEL_DURATION_BONUS[duration] })}
          </Text>
        </GlassCard>

        <Pressable
          onPress={() => createMut.mutate()}
          disabled={createMut.isPending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: c.primary,
              opacity: createMut.isPending ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[styles.sendBtnText, { color: c.textOnPrimary }]}>
            ⚔ {t("duels.challenge.send")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={[styles.cancelBtn, { borderColor: c.border }]}
        >
          <Text style={[styles.cancelBtnText, { color: c.textMuted }]}>
            {t("duels.challenge.cancel")}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  username: {
    fontSize: typography.xl,
    fontWeight: "800",
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: typography.sm,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  label: {
    fontSize: typography.sm,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  durationGrid: { gap: spacing.md, marginBottom: spacing.lg },
  durationBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  durationLabel: { fontSize: typography.base, fontWeight: "800" },
  durationXp: { fontSize: typography.xs, marginTop: 4 },
  rewardCard: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xl,
    alignItems: "center",
  },
  rewardLabel: {
    fontSize: typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rewardValue: { fontSize: typography.lg, fontWeight: "800", marginTop: 4 },
  sendBtn: {
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sendBtnText: { fontWeight: "800", fontSize: typography.base },
  cancelBtn: {
    borderRadius: 999,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelBtnText: { fontWeight: "700", fontSize: typography.sm },
});
