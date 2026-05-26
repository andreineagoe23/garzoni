import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { DuelRecord } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";
import GlassCard from "../ui/GlassCard";
import { leaderboardAvatarUri } from "../leaderboard/leaderboardAvatarUri";
import { formatCountdown, formatPast } from "./duelTime";

type Props = {
  duel: DuelRecord;
  currentUserId: number | null;
  onPress?: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
};

function selfAndOther(duel: DuelRecord, currentUserId: number | null) {
  const youAreChallenger =
    currentUserId !== null && duel.challenger.id === currentUserId;
  if (youAreChallenger) {
    return { self: duel.challenger, other: duel.opponent };
  }
  return { self: duel.opponent, other: duel.challenger };
}

export default function DuelCard({
  duel,
  currentUserId,
  onPress,
  t,
  locale,
}: Props) {
  const c = useThemeColors();
  const { self, other } = selfAndOther(duel, currentUserId);

  const otherAvatar = leaderboardAvatarUri(other.profile_avatar ?? null);

  let statusLine = "";
  if (duel.status === "pending") {
    statusLine =
      duel.viewer_role === "challenger"
        ? t("duels.card.outgoing", { username: other.username })
        : t("duels.card.incoming", { username: other.username });
  } else if (duel.status === "active") {
    statusLine = t("duels.card.endsIn", {
      when: formatCountdown(duel.ends_at, t),
    });
  } else {
    statusLine = t("duels.card.ended", {
      when: formatPast(duel.finished_at, locale),
    });
  }

  let leadLine = "";
  if (duel.status === "active" || duel.status === "pending") {
    const diff = self.xp_delta - other.xp_delta;
    if (diff > 0)
      leadLine = t("duels.card.leadingBy", {
        xp: diff.toLocaleString(locale),
      });
    else if (diff < 0)
      leadLine = t("duels.card.behindBy", {
        xp: Math.abs(diff).toLocaleString(locale),
      });
    else leadLine = t("duels.card.tied");
  }

  const statusKey =
    duel.status === "won_by_challenger"
      ? duel.viewer_role === "challenger"
        ? "won"
        : "lost"
      : duel.status === "won_by_opponent"
        ? duel.viewer_role === "opponent"
          ? "won"
          : "lost"
        : duel.status === "draw"
          ? "draw"
          : duel.status;

  const statusBg =
    duel.status === "active"
      ? `${c.primary}22`
      : duel.status === "pending"
        ? `${c.accent}22`
        : c.surfaceOffset;
  const statusFg =
    duel.status === "active"
      ? c.primary
      : duel.status === "pending"
        ? c.accent
        : c.textMuted;

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <GlassCard
        padding="md"
        style={[
          styles.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <View style={styles.headerRow}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatar} />
          ) : (
            <View
              style={[styles.avatar, { backgroundColor: c.surfaceOffset }]}
            />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.opponent, { color: c.text }]}
              numberOfLines={1}
            >
              {t("duels.card.vs", { username: other.username })}
            </Text>
            <Text style={[styles.subline, { color: c.textMuted }]}>
              {statusLine}
            </Text>
          </View>
          <View
            style={[styles.statusPill, { backgroundColor: statusBg }]}
          >
            <Text style={[styles.statusPillText, { color: statusFg }]}>
              {t(`duels.status.${statusKey}`)}
            </Text>
          </View>
        </View>

        {duel.status === "active" || duel.status === "pending" ? (
          <View style={styles.scoreRow}>
            <ScoreCol
              label={t("duels.detail.yourScore")}
              value={self.xp_delta}
              accent={c.primary}
              text={c.text}
              locale={locale}
            />
            <Text style={[styles.vs, { color: c.textFaint }]}>—</Text>
            <ScoreCol
              label={other.username}
              value={other.xp_delta}
              accent={c.accent}
              text={c.text}
              locale={locale}
              alignRight
            />
          </View>
        ) : null}

        {leadLine ? (
          <Text style={[styles.leadLine, { color: c.textMuted }]}>
            {leadLine}
          </Text>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

function ScoreCol({
  label,
  value,
  accent,
  text,
  locale,
  alignRight,
}: {
  label: string;
  value: number;
  accent: string;
  text: string;
  locale: string;
  alignRight?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: alignRight ? "flex-end" : "flex-start",
      }}
    >
      <Text style={[styles.scoreLabel, { color: text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.scoreValue, { color: accent }]}>
        {value.toLocaleString(locale)} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.full },
  opponent: { fontSize: typography.base, fontWeight: "800" },
  subline: { fontSize: typography.xs, marginTop: 2 },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  scoreLabel: { fontSize: typography.xs, fontWeight: "600" },
  scoreValue: { fontSize: typography.lg, fontWeight: "800", marginTop: 2 },
  vs: { fontSize: typography.lg, fontWeight: "800" },
  leadLine: {
    marginTop: spacing.sm,
    fontSize: typography.xs,
    fontWeight: "600",
  },
});
