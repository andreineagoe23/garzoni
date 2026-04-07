import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography } from "../../theme/tokens";
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

export default function RewardCard({ item, balance = 0, isDonate = false, onPress }: Props) {
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
    <Pressable onPress={onPress ? () => onPress(item) : undefined} disabled={!onPress}>
      <GlassCard padding="md">
        {uri ? (
          <Image source={{ uri }} style={styles.img} resizeMode="cover" />
        ) : null}
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {item.description ? (
          <Text style={[styles.desc, { color: c.textMuted }]} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
        <Text
          style={[
            styles.cost,
            { color: canAfford ? c.primary : c.textMuted },
          ]}
        >
          {cost} coins · {isDonate ? "Donate" : "Buy"}
        </Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: 120, borderRadius: 12, marginBottom: spacing.sm },
  title: { fontSize: typography.md, fontWeight: "700" },
  desc: { fontSize: typography.sm, marginTop: 4 },
  cost: { fontSize: typography.sm, fontWeight: "600", marginTop: spacing.sm },
});
