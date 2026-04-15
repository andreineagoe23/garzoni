import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { requestPasswordReset } from "@garzoni/core";
import { useTranslation } from "react-i18next";
import AuthLogoMark from "../../src/components/auth/AuthLogoMark";
import AuthScreenLayout from "../../src/components/auth/AuthScreenLayout";
import GlassAuthCard from "../../src/components/auth/GlassAuthCard";
import GlassButton from "../../src/components/ui/GlassButton";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { radius, spacing, typography } from "../../src/theme/tokens";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("auth.validation.emailRequired"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setError(t("auth.validation.emailInvalid"));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch {
      setError(t("auth.forgotPassword.error"));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthScreenLayout mode="minimal">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GlassAuthCard>
            <AuthLogoMark />
            <Text style={[styles.title, { color: c.text }]}>
              {t("auth.forgotPassword.sentTitle")}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {t("auth.forgotPassword.sentBody", {
                email: email.trim(),
              })}
            </Text>
            <Link href="/login" style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: c.primary }]}>
                {t("auth.forgotPassword.backToLogin")}
              </Text>
            </Link>
          </GlassAuthCard>
        </ScrollView>
      </AuthScreenLayout>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AuthScreenLayout mode="minimal">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GlassAuthCard>
            <AuthLogoMark />

            <Text style={[styles.titleAccent, { color: c.primary }]}>
              {t("auth.forgotPassword.title")}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {t("auth.forgotPassword.subtitle")}
            </Text>

            {error ? (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: c.errorBg, borderColor: c.error },
                ]}
              >
                <Text style={[styles.errorText, { color: c.error }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: c.textMuted }]}>
                {t("auth.forgotPassword.email")}
              </Text>
              <RNTextInput
                style={[
                  styles.input,
                  {
                    borderColor: c.border,
                    backgroundColor: c.inputBg,
                    color: c.text,
                  },
                ]}
                placeholder={t("auth.forgotPassword.emailPlaceholder")}
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
                returnKeyType="done"
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => void onSubmit()}
              />
            </View>

            <GlassButton
              variant="active"
              size="lg"
              loading={loading}
              onPress={() => void onSubmit()}
            >
              {loading
                ? t("auth.forgotPassword.submitting")
                : t("auth.forgotPassword.submit")}
            </GlassButton>

            <Link href="/login" style={styles.backWrap}>
              <Text style={[styles.backLinkText, { color: c.primary }]}>
                {t("auth.forgotPassword.backToLogin")}
              </Text>
            </Link>
          </GlassAuthCard>
        </ScrollView>
      </AuthScreenLayout>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: spacing.xxxxl,
    paddingTop: spacing.md,
  },

  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.md,
  },
  titleAccent: {
    fontSize: typography.xxl,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sm,
    textAlign: "center",
    marginBottom: spacing.xxl,
    lineHeight: 20,
  },

  fieldWrap: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.sm,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    fontSize: typography.base,
  },

  errorBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { fontSize: typography.sm },

  backWrap: {
    alignSelf: "center",
    marginTop: spacing.xl,
  },
  backLink: {
    alignSelf: "center",
    marginTop: spacing.lg,
  },
  backLinkText: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
});
