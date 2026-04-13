import { StyleSheet, Text, View } from "react-native";
import type { MascotMood, MascotSituation, MascotType } from "@garzoni/core";
import { useMascotMessage } from "@garzoni/core";
import { useMascotMotionSimplify } from "../../hooks/useMascotMotionSimplify";
import { useThemeColors } from "../../theme/ThemeContext";
import GlassCard from "../ui/GlassCard";
import { spacing, typography, radius } from "../../theme/tokens";
import MascotImage from "./MascotImage";

type Props = {
  mood?: MascotMood;
  situation?: MascotSituation;
  rotationKey?: number;
  /** Same as web: keep one character while messages rotate. */
  fixedMascot?: MascotType;
  /** Overrides pooled message when set (e.g. section insight). */
  customMessage?: string;
  /** Omit outer GlassCard so the block can sit inside a parent hero card. */
  embedded?: boolean;
  mascotSize?: number;
};

/**
 * Contextual mascot + speech bubble (parity with web `MascotWithMessage`).
 */
export default function MascotWithMessage({
  mood = "neutral",
  situation,
  rotationKey = 0,
  fixedMascot,
  customMessage,
  embedded = false,
  mascotSize = 64,
}: Props) {
  const c = useThemeColors();
  const motionSimplify = useMascotMotionSimplify();
  const displayMascotSize = motionSimplify
    ? Math.min(mascotSize, 52)
    : mascotSize;

  const { mascot, message: pooledMessage } = useMascotMessage(mood, {
    rotateMessages: true,
    rotationKey,
    mascotOverride: fixedMascot,
    situation,
  });
  const message = customMessage ?? pooledMessage;

  const inner = (
    <View style={styles.row}>
      <MascotImage mascot={mascot} size={displayMascotSize} />
      <View
        style={[
          styles.bubble,
          { backgroundColor: c.surface },
          motionSimplify && [
            styles.bubbleReducedMotion,
            { borderColor: c.border },
          ],
        ]}
      >
        <Text style={[styles.msg, { color: c.text }]}>{message}</Text>
      </View>
    </View>
  );

  if (embedded) {
    return inner;
  }

  if (motionSimplify) {
    return (
      <View
        style={[
          styles.simpleCard,
          {
            borderColor: c.border,
            backgroundColor: c.surface,
          },
        ]}
      >
        {inner}
      </View>
    );
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
  simpleCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bubble: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bubbleReducedMotion: {
    borderWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  msg: { fontSize: typography.sm, lineHeight: 20 },
});
