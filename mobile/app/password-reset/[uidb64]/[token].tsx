/**
 * Password reset confirm screen — handles the Universal Link deep link
 * emailed to the user: https://monevo.tech/password-reset/<uidb64>/<token>
 *
 * When iOS Universal Links are configured (AASA file + entitlements), tapping
 * the reset link in the email opens this screen instead of Safari.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { confirmPasswordReset } from "@monevo/core";
import { Button, FormInput } from "../../../src/components/ui";
import { colors, spacing, typography, radius } from "../../../src/theme/tokens";

export default function PasswordResetConfirmScreen() {
  const { uidb64, token } = useLocalSearchParams<{
    uidb64: string;
    token: string;
  }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError("");

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!uidb64 || !token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(uidb64, token, {
        new_password: password,
        confirm_password: confirm,
      });
      setDone(true);
    } catch {
      setError("The reset link has expired or is invalid. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.title}>Password updated</Text>
        <Text style={styles.subtitle}>
          Your password has been changed successfully.
        </Text>
        <Button onPress={() => router.replace("/login")}>Back to Login</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>
          Enter and confirm your new password below.
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormInput
          label="New password"
          placeholder="At least 8 characters"
          secureTextEntry
          autoFocus
          returnKeyType="next"
          value={password}
          onChangeText={setPassword}
        />

        <FormInput
          label="Confirm password"
          placeholder="Repeat your new password"
          secureTextEntry
          returnKeyType="done"
          value={confirm}
          onChangeText={setConfirm}
          onSubmitEditing={() => void onSubmit()}
        />

        <Button loading={loading} onPress={() => void onSubmit()}>
          Reset password
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xxl, paddingTop: spacing.xxxxl },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  icon: { fontSize: 56, marginBottom: spacing.lg },
  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
    lineHeight: 22,
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: typography.sm },
});
