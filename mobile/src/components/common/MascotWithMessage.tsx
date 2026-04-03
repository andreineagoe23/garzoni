import { StyleSheet, Text, View } from "react-native";
import type { MascotMood } from "@monevo/core";
import { useMascotMessage } from "@monevo/core";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography, radius } from "../../theme/tokens";
import MascotImage from "./MascotImage";

type Props = {
  mood?: MascotMood;
  rotationKey?: number;
};

/**
 * Contextual mascot + speech bubble (web parity with `MascotWithMessage`).
 */
export default function MascotWithMessage({
  mood = "encourage",
  rotationKey = 0,
}: Props) {
  const c = useThemeColors();
  const { mascot, message } = useMascotMessage(mood, {
    rotateMessages: true,
    rotationKey,
  });

  return (
    <GlassCard padding="md" style={{ backgroundColor: c.accentMuted, borderColor: c.accent }}>
      <View style={styles.row}>
        <MascotImage mascot={mascot} size={64} />
        <View style={[styles.bubble, { backgroundColor: c.surface }]}>
          <Text style={[styles.msg, { color: c.text }]}>{message}</Text>
        </View>
      </View>
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
