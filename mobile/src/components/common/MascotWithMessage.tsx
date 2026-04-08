import { StyleSheet, Text, View } from "react-native";
import type { MascotMood } from "@garzoni/core";
import { useMascotMessage } from "@garzoni/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography, radius } from "../../theme/tokens";
import MascotImage from "./MascotImage";

type Props = {
  mood?: MascotMood;
  rotationKey?: number;
  /** Omit outer GlassCard so the block can sit inside a parent hero card. */
  embedded?: boolean;
  mascotSize?: number;
};

/**
 * Contextual mascot + speech bubble (web parity with `MascotWithMessage`).
 */
export default function MascotWithMessage({
  mood = "encourage",
  rotationKey = 0,
  embedded = false,
  mascotSize = 64,
}: Props) {
  const c = useThemeColors();
  const { mascot, message } = useMascotMessage(mood, {
    rotateMessages: true,
    rotationKey,
  });

  const inner = (
    <View style={styles.row}>
      <MascotImage mascot={mascot} size={mascotSize} />
      <View style={[styles.bubble, { backgroundColor: c.surface }]}>
        <Text style={[styles.msg, { color: c.text }]}>{message}</Text>
      </View>
    </View>
  );

  if (embedded) {
    return inner;
  }

  return (
    <GlassCard
      padding="md"
      style={{ backgroundColor: c.accentMuted, borderColor: c.accent }}
    >
      {inner}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bubble: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  msg: { fontSize: typography.sm, lineHeight: 20 },
});
