import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeColors } from "../../../theme/ThemeContext";
import { spacing, typography, radius } from "../../../theme/tokens";
import LoadingSpinner from "../../ui/LoadingSpinner";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;

type Props = {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  text: string;
};

export function AiExplanationSheet({
  visible,
  onClose,
  loading,
  error,
  text,
}: Props) {
  const c = useThemeColors();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 3,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.backdropFill, { backgroundColor: c.overlay }]} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.surface,
            height: SHEET_HEIGHT,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.aiDot, { backgroundColor: c.accent }]} />
            <Text style={[styles.title, { color: c.text }]}>
              AI Portfolio Take
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <Text style={[styles.closeX, { color: c.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          <Text style={[styles.caption, { color: c.textMuted }]}>
            Powered by your portfolio snapshot • Not financial advice
          </Text>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {loading && (
            <View style={styles.loadingRow}>
              <LoadingSpinner size="sm" />
              <Text style={[styles.loadingText, { color: c.textMuted }]}>
                Analyzing your portfolio…
              </Text>
            </View>
          )}

          {error && !loading && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: c.errorBg, borderColor: c.error },
              ]}
            >
              <Text style={[styles.errorText, { color: c.error }]}>
                {error}
              </Text>
            </View>
          )}

          {text && !loading && (
            <Text style={[styles.aiText, { color: c.text }]}>{text}</Text>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdropFill: { flex: 1 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  aiDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: "700",
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeX: {
    fontSize: typography.md,
    fontWeight: "600",
  },
  caption: {
    fontSize: typography.xs,
  },
  divider: {
    height: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontSize: typography.sm,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontSize: typography.sm,
  },
  aiText: {
    fontSize: typography.base,
    lineHeight: 22,
    whiteSpace: "pre-line",
  } as any,
});
