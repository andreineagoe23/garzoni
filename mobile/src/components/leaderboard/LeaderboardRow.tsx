import type { LeaderboardEntry } from "@monevo/core";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";
import { leaderboardAvatarUri } from "./leaderboardAvatarUri";

type Props = {
  entry: LeaderboardEntry;
  position: number;
  isYou: boolean;
  showFriendButton: boolean;
  isFriend: boolean;
  pending: boolean;
  onAddFriend?: () => void;
  busy?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  formatPoints: (n: number) => string;
};

export default function LeaderboardRow({
  entry,
  position,
  isYou,
  showFriendButton,
  isFriend,
  pending,
  onAddFriend,
  busy,
  t,
  formatPoints,
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
        <View style={[styles.rankBadge, { backgroundColor: c.surfaceOffset }]}>
          <Text style={[styles.rankText, { color: c.text }]}>#{position}</Text>
        </View>
        {uri ? (
          <Image source={{ uri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: c.surfaceOffset }]} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {entry.user?.username ?? "—"}
            </Text>
            {isYou ? (
              <View style={[styles.youPill, { backgroundColor: `${c.accent}28` }]}>
                <Text style={[styles.youPillText, { color: c.primary }]}>
                  {t("leaderboard.youBadge")}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.points, { color: c.textMuted }]}>
            {t("leaderboard.points", {
              points: formatPoints(entry.points ?? 0),
            })}
          </Text>
        </View>
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
                  color: isFriend ? c.accent : pending ? c.textMuted : c.textOnPrimary,
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
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: typography.sm, fontWeight: "800" },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  nameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  name: { fontSize: typography.base, fontWeight: "700", flexShrink: 1 },
  youPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  youPillText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  points: { fontSize: typography.sm, marginTop: 2 },
  friendBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    maxWidth: 120,
  },
  friendBtnText: { fontSize: typography.xs, fontWeight: "700", textAlign: "center" },
});
