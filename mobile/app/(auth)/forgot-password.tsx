import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { requestPasswordReset } from "@garzoni/core";
import { Button, FormInput } from "../../src/components/ui";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch {
      setError("Could not send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.checkIcon}>📬</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a password reset link to{"\n"}
          <Text style={styles.emailHighlight}>{email.trim()}</Text>
        </Text>
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
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter the email associated with your account and we'll send a reset
          link.
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormInput
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
          returnKeyType="done"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => void onSubmit()}
        />

        <Button loading={loading} onPress={() => void onSubmit()}>
          Send reset link
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
  checkIcon: { fontSize: 56, marginBottom: spacing.lg },
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
  emailHighlight: { fontWeight: "600", color: colors.text },
  errorBanner: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: typography.sm },
});
