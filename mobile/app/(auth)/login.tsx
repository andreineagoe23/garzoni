import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { Images, loginSecure, obtainTokenPair } from "@garzoni/core";
import { useTranslation } from "react-i18next";
import { useAuthSession } from "../../src/auth/AuthContext";
import { replaceAfterSocialAuth } from "../../src/auth/replaceAfterSocialAuth";
import { formatAuthRequestError } from "../../src/auth/authErrorMessage";
import AuthBackendBanner from "../../src/components/AuthBackendBanner";
import { AuthSocialSection } from "../../src/components/AuthSocialSection";
import AuthLogoMark from "../../src/components/auth/AuthLogoMark";
import AuthScreenLayout from "../../src/components/auth/AuthScreenLayout";
import GlassAuthCard from "../../src/components/auth/GlassAuthCard";
import GlassButton from "../../src/components/ui/GlassButton";
import { useThemeColors } from "../../src/theme/ThemeContext";
import { radius, spacing, typography } from "../../src/theme/tokens";

type TokenResponseLike = {
  access?: string;
  access_token?: string;
  token?: string;
  refresh?: string;
  refresh_token?: string;
  data?: {
    access?: string;
    access_token?: string;
    token?: string;
    refresh?: string;
    refresh_token?: string;
  };
};

function extractTokens(payload: TokenResponseLike): {
  access: string | null;
  refresh?: string;
} {
  const directAccess = payload.access ?? payload.access_token ?? payload.token;
  const nestedAccess =
    payload.data?.access ?? payload.data?.access_token ?? payload.data?.token;
  const access = (directAccess ?? nestedAccess ?? null) as string | null;
  const refresh = (payload.refresh ??
    payload.refresh_token ??
    payload.data?.refresh ??
    payload.data?.refresh_token) as string | undefined;
  return { access, refresh };
}

export default function LoginScreen() {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const { applyTokens } = useAuthSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<RNTextInput>(null);

  const bgUri = Images.loginBg || undefined;

  const onSubmit = async () => {
    setError("");
    if (!username.trim()) {
      setError(t("auth.validation.usernameRequired"));
      return;
    }
    if (!password) {
      setError(t("auth.validation.passwordRequired"));
      return;
    }
    setLoading(true);
    try {
      const { data } = await loginSecure({
        username: username.trim(),
        password,
        client_type: "mobile",
        platform: "mobile",
      });
      const { access, refresh } = extractTokens(data as TokenResponseLike);
      if (access) {
        await applyTokens(access, refresh);
        router.replace("/");
      } else {
        const fallback = await obtainTokenPair({
          username: username.trim(),
          password,
        });
        const fallbackAccess = fallback.data?.access;
        if (fallbackAccess) {
          await applyTokens(fallbackAccess, fallback.data?.refresh);
          router.replace("/");
        } else {
          const keys =
            data && typeof data === "object"
              ? Object.keys(data as Record<string, unknown>).join(", ")
              : typeof data;
          setError(
            `No access token returned from server. Response keys: ${keys || "none"}`,
          );
        }
      }
    } catch (e: unknown) {
      setError(
        formatAuthRequestError(e, t("auth.login.loginFailed")),
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
      <AuthScreenLayout mode="login" backgroundUri={bgUri}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GlassAuthCard>
            <AuthLogoMark />
            <AuthBackendBanner />

            <Text style={[styles.title, { color: c.text }]}>
              {t("auth.login.title")}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {t("auth.login.subtitle")}
            </Text>

            {error ? (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: c.errorBg, borderColor: c.error },
                ]}
              >
                <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: c.textMuted }]}>
                {t("auth.login.username")}
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
                placeholder={t("auth.login.usernamePlaceholder")}
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="next"
                value={username}
                onChangeText={setUsername}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: c.textMuted }]}>
                {t("auth.login.password")}
              </Text>
              <View style={styles.passwordWrap}>
                <RNTextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      borderColor: c.border,
                      backgroundColor: c.inputBg,
                      color: c.text,
                    },
                  ]}
                  placeholder={t("auth.login.passwordPlaceholder")}
                  placeholderTextColor={c.textFaint}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void onSubmit()}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword
                      ? t("auth.login.hidePassword")
                      : t("auth.login.showPassword")
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={c.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            <Link href="/(auth)/forgot-password" style={styles.forgotWrap}>
              <Text style={[styles.forgotText, { color: c.primary }]}>
                {t("auth.login.forgotPassword")}
              </Text>
            </Link>

            <GlassButton
              variant="active"
              size="lg"
              loading={loading}
              onPress={() => void onSubmit()}
            >
              {loading ? t("auth.login.submitting") : t("auth.login.submit")}
            </GlassButton>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              <Text style={[styles.dividerText, { color: c.textMuted }]}>
                {t("auth.orContinueWith")}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            </View>

            <AuthSocialSection
              onSuccess={async (access, refresh, meta) => {
                await applyTokens(access, refresh);
                replaceAfterSocialAuth(meta?.next);
              }}
              onError={(m) => setError(m)}
            />

            <View style={styles.bottomRow}>
              <Text style={[styles.bottomText, { color: c.textMuted }]}>
                {t("auth.login.noAccount")}{" "}
              </Text>
              <Link href="/register">
                <Text style={[styles.bottomLink, { color: c.primary }]}>
                  {t("auth.login.signUpNow")}
                </Text>
              </Link>
            </View>
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sm,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },

  errorBanner: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { fontSize: typography.sm },

  fieldWrap: { marginBottom: spacing.md },
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
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  forgotWrap: { alignSelf: "flex-end", marginBottom: spacing.lg },
  forgotText: {
    fontSize: typography.sm,
    fontWeight: "600",
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.xs,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: spacing.xl,
  },
  bottomText: { fontSize: typography.sm },
  bottomLink: {
    fontSize: typography.sm,
    fontWeight: "600",
  },
});
