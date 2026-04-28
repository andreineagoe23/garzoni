/**
 * Password reset confirm screen — handles the Universal Link deep link
 * emailed to the user: https://garzoni.app/password-reset/<uidb64>/<token>
 *
 * When iOS Universal Links are configured (AASA file + entitlements), tapping
 * the reset link in the email opens this screen instead of Safari.
 */
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { confirmPasswordReset } from "@garzoni/core";
import { Button, FormInput } from "../../../src/components/ui";
import { useAuthSession } from "../../../src/auth/AuthContext";
import { useThemeColors } from "../../../src/theme/ThemeContext";
import { spacing, typography, radius } from "../../../src/theme/tokens";

export default function PasswordResetConfirmScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
  const { clearSession } = useAuthSession();
  const { uidb64, token } = useLocalSearchParams<{
    uidb64: string;
    token: string;
  }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1, backgroundColor: c.bg },
        container: { padding: spacing.xxl, paddingTop: spacing.xxxxl },
        centered: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.bg,
        },
        icon: { fontSize: 56, marginBottom: spacing.lg },
        title: {
          fontSize: typography.xxl,
          fontWeight: "700",
          color: c.text,
          marginBottom: spacing.sm,
          textAlign: "center",
        },
        subtitle: {
          fontSize: typography.base,
          color: c.textMuted,
          marginBottom: spacing.xxl,
          lineHeight: 22,
          textAlign: "center",
        },
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

  const goToLoginCleared = async () => {
    await clearSession();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({
      type: "success",
      text1: t("auth.resetPassword.mobileSuccessToastTitle"),
      text2: t("auth.resetPassword.mobileSuccessToastBody"),
    });
    router.replace("/login");
  };

  const onSubmit = async () => {
    setError("");

    if (!password || password.length < 8) {
      setError(t("auth.resetPassword.mobileMinLength"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.resetPassword.mobileMismatch"));
      return;
    }
    if (!uidb64 || !token) {
      setError(t("auth.resetPassword.mobileInvalidLink"));
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
      setError(t("auth.resetPassword.mobileLinkInvalid"));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t("auth.resetPassword.mobileSetTitle"),
            headerShown: true,
          }}
        />
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.title}>
            {t("auth.resetPassword.mobileSuccessTitle")}
          </Text>
          <Text style={styles.subtitle}>
            {t("auth.resetPassword.mobileSuccessBody")}
          </Text>
          <Button onPress={() => void goToLoginCleared()}>
            {t("auth.resetPassword.mobileBackLogin")}
          </Button>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t("auth.resetPassword.mobileSetTitle"),
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            {t("auth.resetPassword.mobileSetTitle")}
          </Text>
          <Text style={styles.subtitle}>
            {t("auth.resetPassword.mobileSetSubtitle")}
          </Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <FormInput
            label={t("auth.resetPassword.mobileNewLabel")}
            placeholder={t("auth.resetPassword.mobileNewPlaceholder")}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="next"
            value={password}
            onChangeText={setPassword}
          />

          <FormInput
            label={t("auth.resetPassword.mobileConfirmLabel")}
            placeholder={t("auth.resetPassword.mobileConfirmPlaceholder")}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="password-new"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={() => void onSubmit()}
          />

          <Button loading={loading} onPress={() => void onSubmit()}>
            {t("auth.resetPassword.mobileSubmit")}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
