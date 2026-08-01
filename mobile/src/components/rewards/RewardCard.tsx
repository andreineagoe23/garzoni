import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { radius, spacing, typography } from "../../theme/tokens";
import { getMediaBaseUrl } from "@garzoni/core";

export type RewardItem = {
  id: number | string;
  name?: string;
  title?: string;
  description?: string;
  cost?: number;
  image?: string;
};

type Props = {
  item: RewardItem;
  balance?: number;
  isDonate?: boolean;
  onPress?: (item: RewardItem) => void;
};

/**
 * Every card is the same size regardless of how long its title/description is:
 * the image slot is always reserved (placeholder when there is no image), the
 * title and description occupy a fixed number of lines, and the cost line is
 * pinned to the bottom. Without this the grid rows ragged out per item.
 */
const IMAGE_HEIGHT = 120;
const TITLE_LINE_HEIGHT = 20;
const TITLE_LINES = 2;
const DESC_LINE_HEIGHT = 18;
const DESC_LINES = 2;

export default function RewardCard({
  item,
  balance = 0,
  isDonate = false,
  onPress,
}: Props) {
  const c = useThemeColors();
  const title = item.title || item.name || "Reward";
  const cost = item.cost ?? 0;
  const canAfford = balance >= cost;
  const uri = item.image
    ? item.image.startsWith("http")
      ? item.image
      : `${getMediaBaseUrl()}/media/${item.image.replace(/^\/+/, "")}`
    : null;

  return (
    <Pressable
      onPress={onPress ? () => onPress(item) : undefined}
      disabled={!onPress}
      style={styles.press}
    >
      <GlassCard padding="md" style={styles.card}>
        {uri ? (
          <Image source={{ uri }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={[styles.img, { backgroundColor: c.surfaceOffset }]} />
        )}
        <Text
          style={[styles.title, { color: c.text }]}
          numberOfLines={TITLE_LINES}
        >
          {title}
        </Text>
        <Text
          style={[styles.desc, { color: c.textMuted }]}
          numberOfLines={DESC_LINES}
        >
          {item.description ?? ""}
        </Text>
        <Text
          style={[styles.cost, { color: canAfford ? c.primary : c.textMuted }]}
        >
          {cost} coins · {isDonate ? "Donate" : "Buy"}
        </Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // flex: 1 all the way down so the card fills the grid cell the FlatList
  // stretches for it, instead of hugging its own content.
  press: { flex: 1 },
  card: { flex: 1 },
  img: {
    width: "100%",
    height: IMAGE_HEIGHT,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.md,
    fontWeight: "700",
    lineHeight: TITLE_LINE_HEIGHT,
    minHeight: TITLE_LINE_HEIGHT * TITLE_LINES,
  },
  desc: {
    fontSize: typography.sm,
    lineHeight: DESC_LINE_HEIGHT,
    minHeight: DESC_LINE_HEIGHT * DESC_LINES,
    marginTop: spacing.xs,
  },
  cost: {
    fontSize: typography.sm,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
});
