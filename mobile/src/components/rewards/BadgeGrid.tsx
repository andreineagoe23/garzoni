import { Image, StyleSheet, Text, View } from "react-native";
import type { BadgeCatalogItem, UserBadgeItem } from "@garzoni/core";
import { getMediaBaseUrl } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";

function badgeImageUri(item: BadgeCatalogItem): string | null {
  const u = item.image_url?.trim();
  if (!u) return null;
  if (u.startsWith("http")) return u;
  return `${getMediaBaseUrl()}/media/${u.replace(/^\/+/, "")}`;
}

type Props = {
  catalog: BadgeCatalogItem[];
  earned: UserBadgeItem[];
};

export default function BadgeGrid({ catalog, earned }: Props) {
  const c = useThemeColors();
  const earnedIds = new Set(earned.map((e) => e.badge.id));

  if (!catalog.length) {
    return (
      <GlassCard padding="md">
        <Text style={[styles.empty, { color: c.textMuted }]}>
          No badges to show yet.
        </Text>
      </GlassCard>
    );
  }

  return (
    <View style={styles.grid}>
      {catalog.slice(0, 12).map((b) => {
        const unlocked = earnedIds.has(b.id);
        const uri = badgeImageUri(b);
        return (
          <GlassCard
            key={b.id}
            padding="sm"
            style={[
              styles.cell,
              {
                borderColor: unlocked ? `${c.primary}66` : c.border,
                opacity: unlocked ? 1 : 0.45,
              },
            ]}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.img} resizeMode="contain" />
            ) : (
              <View
                style={[styles.img, { backgroundColor: c.surfaceOffset }]}
              />
            )}
            <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
              {b.name}
            </Text>
          </GlassCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  cell: {
    width: "30%",
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  img: { width: 48, height: 48, marginBottom: spacing.xs },
  name: { fontSize: typography.xs, fontWeight: "600", textAlign: "center" },
  empty: { fontSize: typography.sm, textAlign: "center" },
});
