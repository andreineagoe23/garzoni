import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import Toast from "react-native-toast-message";
import { useMutation } from "@tanstack/react-query";
import { submitFeedback } from "@garzoni/core";
import GlassButton from "../ui/GlassButton";
import { useThemeColors } from "../../theme/ThemeContext";
import { spacing, typography, radius } from "../../theme/tokens";

type Props = {
  visible: boolean;
  currentRoute?: string;
  userEmail?: string;
  onDismiss: () => void;
};

function buildDeviceMeta(): string {
  const version = Constants.expoConfig?.version ?? "unknown";
  const platform = Platform.OS;
  const osVersion = Platform.Version;
  return `\n\n---\nApp: ${version} | Platform: ${platform} ${osVersion}`;
}

export default function ShakeFeedbackModal({
  visible,
  currentRoute,
  userEmail,
  onDismiss,
}: Props) {
  const c = useThemeColors();
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      submitFeedback({
        email: userEmail,
        topic: "Shake Report",
        feedback_type: "bug",
        context_url: currentRoute ?? "mobile",
        message: message.trim() + buildDeviceMeta(),
      }),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: "success",
        text1: "Feedback sent!",
        text2: "Thanks — we'll look into it.",
      });
      setMessage("");
      onDismiss();
    },
    onError: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({
        type: "error",
        text1: "Couldn't send",
        text2: "Try again in a moment.",
      });
    },
  });

  const canSubmit = message.trim().length >= 5 && !mutation.isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              entering={SlideInDown.springify().damping(18)}
              exiting={SlideOutDown.duration(220)}
              style={[
                styles.sheet,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[styles.title, { color: c.text }]}>
                🐛 Found a bug?
              </Text>
              <Text style={[styles.body, { color: c.textMuted }]}>
                Tell us what happened. Device info is attached automatically.
              </Text>

              <TextInput
                style={[
                  styles.input,
                  {
                    color: c.text,
                    borderColor: c.border,
                    backgroundColor: c.surfaceOffset,
                  },
                ]}
                placeholder="Describe the bug or idea…"
                placeholderTextColor={c.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={2000}
                autoFocus
              />

              <GlassButton
                variant="primary"
                onPress={() => mutation.mutate()}
                style={{ marginTop: spacing.md }}
                disabled={!canSubmit}
              >
                {mutation.isPending ? "Sending…" : "Send Report"}
              </GlassButton>

              <Pressable onPress={onDismiss} style={{ marginTop: spacing.md }}>
                <Text style={[styles.dismiss, { color: c.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheetWrap: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sheet: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 100,
    fontSize: typography.sm,
    textAlignVertical: "top",
  },
  dismiss: {
    fontSize: typography.sm,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
