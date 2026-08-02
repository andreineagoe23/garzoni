import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { BadgeCatalogItem, UserBadgeItem } from "@garzoni/core";
import { getMediaBaseUrl } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { radius, spacing, typography } from "../../theme/tokens";

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

const MAX_TILES = 12;

/**
 * One section card holding flat badge tiles.
 *
 * Every badge used to be its own GlassCard — twelve elevated, shadowed
 * surfaces stacked inside the page, which is not how any other section in the
 * app is built. The card is now the section; tiles are flat fills on it.
 * Locked badges dim the artwork only (with a lock chip), never the label,
 * which used to sit at 45% opacity and be unreadable.
 */
export default function BadgeGrid({ catalog, earned }: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const earnedIds = new Set(earned.map((e) => e.badge.id));

  if (!catalog.length) {
    return (
      <GlassCard padding="md">
        <Text style={[styles.title, { color: c.text }]}>
          {t("rewards.badges.title")}
        </Text>
        <Text style={[styles.empty, { color: c.textMuted }]}>
          {t("rewards.badges.empty")}
        </Text>
      </GlassCard>
    );
  }

  const tiles = catalog.slice(0, MAX_TILES);
  const unlockedCount = catalog.filter((b) => earnedIds.has(b.id)).length;

  return (
    <GlassCard padding="md">
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>
          {t("rewards.badges.title")}
        </Text>
        <Text style={[styles.count, { color: c.textMuted }]}>
          {t("rewards.badges.count", {
            earned: unlockedCount,
            total: catalog.length,
          })}
        </Text>
      </View>

      <View style={styles.grid}>
        {tiles.map((b) => {
          const unlocked = earnedIds.has(b.id);
          const uri = badgeImageUri(b);
          return (
            <View
              key={b.id}
              style={[
                styles.cell,
                {
                  backgroundColor: unlocked
                    ? `${c.primary}14`
                    : c.surfaceOffset,
                  borderColor: unlocked ? `${c.primary}55` : "transparent",
                },
              ]}
              accessibilityLabel={
                unlocked
                  ? b.name
                  : `${b.name} — ${t("rewards.badges.lockedHint")}`
              }
            >
              <View style={styles.artWrap}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={[styles.img, !unlocked && styles.imgLocked]}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.img,
                      styles.imgFallback,
                      { backgroundColor: c.surface },
                    ]}
                  >
                    <Ionicons
                      name="ribbon-outline"
                      size={20}
                      color={c.textFaint}
                    />
                  </View>
                )}
                {!unlocked ? (
                  <View
                    style={[styles.lockChip, { backgroundColor: c.surface }]}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={10}
                      color={c.textMuted}
                    />
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.name,
                  { color: unlocked ? c.text : c.textMuted },
                ]}
                numberOfLines={2}
              >
                {b.name}
              </Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}

// Reserve two lines for the name so a one-word badge and a wrapping one
// produce identically sized cells (the grid used to ladder otherwise).
const NAME_LINE_HEIGHT = 15;
const NAME_LINES = 2;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { fontSize: typography.base, fontWeight: "800" },
  count: { fontSize: typography.xs, fontWeight: "600" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cell: {
    // Three per row: (100% - 2 gaps) / 3. Left-aligned so a short last row
    // keeps the column rhythm instead of centring under the ones above.
    flexBasis: "31.5%",
    flexGrow: 0,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
  },
  artWrap: { marginBottom: spacing.xs },
  img: { width: 44, height: 44 },
  imgLocked: { opacity: 0.35 },
  imgFallback: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  lockChip: {
    position: "absolute",
    right: -4,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: typography.xs,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: NAME_LINE_HEIGHT,
    minHeight: NAME_LINE_HEIGHT * NAME_LINES,
  },
  empty: { fontSize: typography.sm, marginTop: spacing.xs },
});
