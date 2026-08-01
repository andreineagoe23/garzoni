import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";
import type { LeaguePromotionZone } from "./leaguePromotionZone";

type Props = {
  zone: LeaguePromotionZone;
  /** Set to "promote" or "demote" on the first row of that zone to render a section divider above it. */
  dividerFor?: "promote" | "demote" | null;
  dividerLabel?: string;
  children: ReactNode;
};

/**
 * Wraps a (reused, unmodified) LeaderboardRow with a coloured left-edge
 * stripe and, at zone boundaries, a small section divider — so the weekly
 * standings list reads as "promotion zone / hold / demotion zone" without
 * forking LeaderboardRow itself.
 */
export default function LeagueZoneRow({
  zone,
  dividerFor,
  dividerLabel,
  children,
}: Props) {
  const c = useThemeColors();
  const stripeColor =
    zone === "promote"
      ? c.success
      : zone === "demote"
        ? c.error
        : "transparent";

  return (
    <View>
      {dividerFor ? (
        <Text
          style={[
            styles.divider,
            { color: dividerFor === "promote" ? c.success : c.error },
          ]}
        >
          {dividerLabel}
        </Text>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.stripe, { backgroundColor: stripeColor }]} />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: { flexDirection: "row", alignItems: "stretch" },
  stripe: { width: 4, borderRadius: 2, marginRight: spacing.sm },
  content: { flex: 1, minWidth: 0 },
});
