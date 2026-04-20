import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { changePassword } from "@garzoni/core";
import { Button, FormInput } from "../src/components/ui";
import { useThemeColors } from "../src/theme/ThemeContext";
import { spacing, typography, radius } from "../src/theme/tokens";

export default function ChangePasswordScreen() {
  const c = useThemeColors();
  const { t } = useTranslation("common");
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
      setError(t("settings.password.fillAll"));
      return;
    }
    if (next.length < 8) {
      setError(t("settings.password.newMinLength"));
      return;
    }
    if (next !== confirm) {
      setError(t("settings.password.newMismatch"));
      return;
    }
    setLoading(true);
    try {
      await changePassword({
        current_password: current,
        new_password: next,
        confirm_password: confirm,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: "success",
        text1: t("settings.success.passwordUpdated"),
      });
      router.back();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(
        typeof err.response?.data?.error === "string"
          ? err.response.data.error
          : t("settings.password.couldNotChange"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("settings.password.title"),
          headerShown: true,
          headerTintColor: c.primary,
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
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <FormInput
            label={t("settings.password.current")}
            secureTextEntry
            value={current}
            onChangeText={setCurrent}
            autoCapitalize="none"
          />
          <FormInput
            label={t("settings.password.new")}
            secureTextEntry
            value={next}
            onChangeText={setNext}
            autoCapitalize="none"
          />
          <FormInput
            label={t("settings.password.confirm")}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
          />
          <Button loading={loading} onPress={() => void onSubmit()}>
            {t("settings.password.update")}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
