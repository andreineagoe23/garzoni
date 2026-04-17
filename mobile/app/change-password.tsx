import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { changePassword } from "@garzoni/core";
import { Button, FormInput } from "../src/components/ui";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

export default function ChangePasswordScreen() {
  const c = useThemeColors();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1, backgroundColor: c.bg },
        container: { padding: spacing.xxl, paddingTop: spacing.lg },
        errorBanner: {
          backgroundColor: c.errorBg,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.lg,
        },
        errorText: { color: c.error, fontSize: typography.sm },
      }),
    [c],
  );

  const onSubmit = async () => {
    setError("");
    if (!current || !next || !confirm) {
      setError("Fill in all fields.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await changePassword({
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      });
      router.back();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(
        typeof err.response?.data?.error === "string"
          ? err.response.data.error
          : "Could not change password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <FormInput
          label="Current password"
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
          autoCapitalize="none"
        />
        <FormInput
          label="New password"
          secureTextEntry
          value={next}
          onChangeText={setNext}
          autoCapitalize="none"
        />
        <FormInput
          label="Confirm new password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
        />
        <Button loading={loading} onPress={() => void onSubmit()}>
          Update password
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
