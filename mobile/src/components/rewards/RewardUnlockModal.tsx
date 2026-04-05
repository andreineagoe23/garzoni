import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import LottieHero from "../motion/LottieHero";
import { Button } from "../ui";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography } from "../../theme/tokens";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  lottieSource?: ComponentProps<typeof LottieHero>["source"];
};

/**
 * Full-screen celebration after a reward action. Wire to real redemption when the API exists.
 */
export default function RewardUnlockModal({
  visible,
  title,
  subtitle = "Keep earning coins to unlock more on your journey.",
  onClose,
  lottieSource,
}: Props) {
  const c = useThemeColors();
  const confettiRef = useRef<ConfettiCannon>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (visible && !reduceMotion) {
      const t = setTimeout(() => confettiRef.current?.start(), 200);
      return () => clearTimeout(t);
    }
  }, [visible, reduceMotion]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: c.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {!reduceMotion ? (
            <ConfettiCannon
              ref={confettiRef}
              count={60}
              origin={{ x: -10, y: 0 }}
              fadeOut
              autoStart={false}
            />
          ) : null}
          <View style={styles.hero}>
            {lottieSource && !reduceMotion ? (
              <LottieHero source={lottieSource} style={styles.lottie} loop={false} />
            ) : (
              <Text style={styles.emoji}>🎁</Text>
            )}
          </View>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>{subtitle}</Text>
          <Button onPress={onClose} style={styles.btn}>
            Nice!
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  sheet: {
    borderRadius: 20,
    padding: spacing.xl,
    overflow: "hidden",
  },
  hero: { alignItems: "center", minHeight: 120, justifyContent: "center" },
  lottie: { width: 160, height: 120 },
  emoji: { fontSize: 72 },
  title: {
    fontSize: typography.xl,
    fontWeight: "800",
    textAlign: "center",
    marginTop: spacing.md,
  },
  sub: {
    fontSize: typography.sm,
    textAlign: "center",
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  btn: { width: "100%" },
});
