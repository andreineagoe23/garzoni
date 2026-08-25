import type { LeaderboardEntry } from "@garzoni/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { radius, spacing, typography } from "../../theme/tokens";
import { leaderboardAvatarUri } from "./leaderboardAvatarUri";
import {
  leaderboardPointsLabel,
  type LeaderboardTimeFilter,
} from "./leaderboardPointsLabel";

type Props = {
  entry: LeaderboardEntry;
  position: number;
  isYou: boolean;
  showFriendButton: boolean;
  isFriend: boolean;
  pending: boolean;
  onAddFriend?: () => void;
  onPrimaryPress?: () => void;
  busy?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  formatPoints: (n: number) => string;
  duelStatus?: "pending" | "active" | null;
  /** Defaults to "all-time" — pass the active tab's filter to surface windowed XP. */
  timeFilter?: LeaderboardTimeFilter;
};

export default function LeaderboardRow({
  entry,
  position,
  isYou,
  showFriendButton,
  isFriend,
  pending,
  onAddFriend,
  onPrimaryPress,
  busy,
  t,
  formatPoints,
  duelStatus,
  timeFilter = "all-time",
}: Props) {
  const c = useThemeColors();
  const uri = leaderboardAvatarUri(entry.user?.profile_avatar ?? null);

  return (
    <GlassCard
      padding="md"
      style={[
        styles.card,
        {
          borderColor: isYou ? `${c.accent}99` : c.border,
          backgroundColor: c.surface,
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          onPress={onPrimaryPress}
          disabled={!onPrimaryPress}
          style={styles.primaryTap}
        >
          <View
            style={[styles.rankBadge, { backgroundColor: c.surfaceOffset }]}
          >
            <Text style={[styles.rankText, { color: c.text }]}>
              #{position}
            </Text>
          </View>
          {uri ? (
            <Image source={{ uri }} style={styles.avatar} />
          ) : (
            <View
              style={[styles.avatar, { backgroundColor: c.surfaceOffset }]}
            />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                {entry.user?.username ?? "—"}
              </Text>
              {isYou ? (
                <View
                  style={[styles.youPill, { backgroundColor: `${c.accent}28` }]}
                >
                  <Text style={[styles.youPillText, { color: c.primary }]}>
                    {t("leaderboard.youBadge")}
                  </Text>
                </View>
              ) : null}
              {duelStatus ? (
                <View
                  style={[
                    styles.duelPill,
                    {
                      backgroundColor:
                        duelStatus === "active"
                          ? `${c.primary}22`
                          : `${c.accent}22`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.duelPillText,
                      {
                        color: duelStatus === "active" ? c.primary : c.accent,
                      },
                    ]}
                  >
                    ⚔ {t(`duels.status.${duelStatus}`)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.points, { color: c.textMuted }]}>
              {leaderboardPointsLabel(t, formatPoints, entry, timeFilter)}
            </Text>
          </View>
          {onPrimaryPress && !showFriendButton ? (
            <Text style={[styles.chevron, { color: c.textFaint }]}>›</Text>
          ) : null}
        </Pressable>
        {showFriendButton ? (
          <Pressable
            onPress={onAddFriend}
            disabled={isFriend || pending || busy}
            style={({ pressed }) => [
              styles.friendBtn,
              {
                opacity: pressed ? 0.85 : 1,
                backgroundColor: isFriend
                  ? `${c.accent}18`
                  : pending
                    ? c.surfaceOffset
                    : c.primary,
                borderWidth: isFriend || pending ? StyleSheet.hairlineWidth : 0,
                borderColor: `${c.accent}44`,
              },
            ]}
            accessibilityLabel={
              isFriend
                ? t("leaderboard.friendStatus.alreadyFriends")
                : pending
                  ? t("leaderboard.friendStatus.pending")
                  : t("leaderboard.friendStatus.addFriend")
            }
          >
            <Text
              style={[
                styles.friendBtnText,
                {
                  color: isFriend
                    ? c.accent
                    : pending
                      ? c.textMuted
                      : c.textOnPrimary,
                },
              ]}
              numberOfLines={1}
            >
              {isFriend
                ? t("leaderboard.friendStatus.friends")
                : pending
                  ? t("leaderboard.friendStatus.pendingShort")
                  : t("leaderboard.friendStatus.addFriendShort")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  primaryTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minWidth: 0,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: typography.sm, fontWeight: "800" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  name: { fontSize: typography.base, fontWeight: "700", flexShrink: 1 },
  youPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  youPillText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  duelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  duelPillText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  points: { fontSize: typography.sm, marginTop: 2 },
  friendBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    maxWidth: 120,
  },
  friendBtnText: {
    fontSize: typography.xs,
    fontWeight: "700",
    textAlign: "center",
  },
  chevron: { fontSize: 20, fontWeight: "300" },
});
