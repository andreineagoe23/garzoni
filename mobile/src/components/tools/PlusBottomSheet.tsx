import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { href } from "../../navigation/href";
import { useThemeColors } from "../../theme/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function PlusBottomSheet({ visible, onClose }: Props) {
  const c = useThemeColors();
  const router = useRouter();

  function goToSubscription() {
    onClose();
    router.push(href("/subscriptions"));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <View style={styles.handle} />
        <Text style={[styles.title, { color: c.text }]}>Plus Feature</Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          This tool is included in the Plus and Pro plans.{"\n"}
          Manage your subscription in your account settings.
        </Text>
        <Pressable
          style={[styles.btnPrimary, { backgroundColor: c.primary }]}
          onPress={goToSubscription}
        >
          <Text style={styles.btnPrimaryText}>View Plans</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} onPress={onClose}>
          <Text style={[styles.btnSecondaryText, { color: c.textMuted }]}>
            Got it
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxxl,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: "rgba(128,128,128,0.35)",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: "700",
  },
  body: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  btnPrimary: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: typography.base,
    fontWeight: "700",
  },
  btnSecondary: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  btnSecondaryText: {
    fontSize: typography.sm,
  },
});
