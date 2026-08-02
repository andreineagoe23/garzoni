import { Modal, Pressable, StyleSheet, Text } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import GlassButton from "../ui/GlassButton";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";

type Props = {
  visible: boolean;
  missionName: string;
  xp: number;
  onDismiss: () => void;
};

export default function RewardClaimModal({
  visible,
  missionName,
  xp,
  onDismiss,
}: Props) {
  const c = useThemeColors();
  const { t } = useTranslation("common");

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: "#000a" }]}
        onPress={onDismiss}
      >
        <Pressable
          style={styles.sheetWrap}
          onPress={(e) => e.stopPropagation()}
        >
          <Animated.View
            // Plain fade pop — the old spring slide overshot and read as a shake.
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(140)}
            style={[
              styles.sheet,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.kicker, { color: c.accent }]}>
              {t("missions.complete.title")}
            </Text>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={3}>
              {t("missions.toast.completed", { name: missionName, xp })}
            </Text>
            <GlassButton
              variant="primary"
              onPress={onDismiss}
              style={{ marginTop: spacing.lg }}
            >
              {t("personalizedPath.open")}
            </GlassButton>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Centred, like every other pop-up on the missions screen.
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center" },
  sheetWrap: { width: "100%", maxWidth: 460, padding: spacing.lg },
  sheet: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  kicker: {
    fontSize: typography.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: typography.md,
    fontWeight: "700",
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
