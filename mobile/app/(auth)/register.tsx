import { forwardRef, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { Images, obtainTokenPair, registerSecure } from "@garzoni/core";
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

type FieldKey =
  | "username"
  | "email"
  | "password"
  | "confirmPassword"
  | "first_name"
  | "last_name";

const Field = forwardRef<
  RNTextInput,
  TextInputProps & { label: string; error?: string }
>(({ label, error, ...rest }, ref) => {
  const c = useThemeColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <RNTextInput
        ref={ref}
        style={[
          styles.input,
          {
            borderColor: error ? c.error : c.border,
            backgroundColor: c.inputBg,
            color: c.text,
          },
        ]}
        placeholderTextColor={c.textFaint}
        {...rest}
      />
      {error ? (
        <Text style={[styles.fieldError, { color: c.error }]}>{error}</Text>
      ) : null}
    </View>
  );
});
Field.displayName = "Field";

export default function RegisterScreen() {
  const { t } = useTranslation("common");
  const c = useThemeColors();
  const { applyTokens } = useAuthSession();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldKey, string>>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);
  const firstRef = useRef<RNTextInput>(null);
  const lastRef = useRef<RNTextInput>(null);

  const bgUri = Images.registerBg || undefined;

  const update = (key: FieldKey, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!form.username.trim())
      errs.username = t("auth.validation.usernameRequired");
    if (!form.email.trim()) errs.email = t("auth.validation.emailRequired");
    else if (!/\S+@\S+\.\S+/.test(form.email.trim()))
      errs.email = t("auth.validation.emailInvalid");
    if (!form.password) errs.password = t("auth.validation.passwordRequired");
    else if (form.password.length < 8)
      errs.password = t("auth.validation.passwordMinLength");
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = t("auth.validation.passwordMismatch");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async () => {
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await registerSecure({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        client_type: "mobile",
        platform: "mobile",
      });
      const { access, refresh } = extractTokens(data as TokenResponseLike);
      if (access) {
        await applyTokens(access, refresh);
        router.replace("/");
      } else {
        const fallback = await obtainTokenPair({
          username: form.username.trim(),
          password: form.password,
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
      const err = e as {
        response?: { data?: { detail?: string; [k: string]: unknown } };
      };
      if (!err.response) {
        setError(formatAuthRequestError(e, t("auth.register.registerFailed")));
      } else {
        const detail = err.response?.data?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (err.response?.data) {
          const msgs = Object.entries(err.response.data)
            .filter(([k]) => k !== "detail")
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
          setError(msgs || t("auth.register.registerFailed"));
        } else {
          setError(t("auth.register.registerFailed"));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    borderColor: c.border,
    backgroundColor: c.inputBg,
    color: c.text,
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AuthScreenLayout mode="register" backgroundUri={bgUri}>
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
              {t("auth.register.title")}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {t("auth.register.subtitle")}
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

            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={[styles.label, { color: c.textMuted }]}>
                  {t("auth.register.firstName")}
                </Text>
                <RNTextInput
                  ref={firstRef}
                  style={[styles.input, inputStyle]}
                  placeholder={t("auth.register.firstNamePlaceholder")}
                  placeholderTextColor={c.textFaint}
                  returnKeyType="next"
                  value={form.first_name}
                  onChangeText={(v) => update("first_name", v)}
                  onSubmitEditing={() => lastRef.current?.focus()}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={[styles.label, { color: c.textMuted }]}>
                  {t("auth.register.lastName")}
                </Text>
                <RNTextInput
                  ref={lastRef}
                  style={[styles.input, inputStyle]}
                  placeholder={t("auth.register.lastNamePlaceholder")}
                  placeholderTextColor={c.textFaint}
                  returnKeyType="next"
                  value={form.last_name}
                  onChangeText={(v) => update("last_name", v)}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <Field
              label={t("auth.register.username")}
              placeholder={t("auth.register.usernamePlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              value={form.username}
              error={fieldErrors.username}
              onChangeText={(v) => update("username", v)}
              onSubmitEditing={() => emailRef.current?.focus()}
            />

            <Field
              ref={emailRef}
              label={t("auth.register.email")}
              placeholder={t("auth.register.emailPlaceholder")}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              value={form.email}
              error={fieldErrors.email}
              onChangeText={(v) => update("email", v)}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: c.textMuted }]}>
                {t("auth.register.password")}
              </Text>
              <View style={styles.passwordWrap}>
                <RNTextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    inputStyle,
                    fieldErrors.password && { borderColor: c.error },
                  ]}
                  placeholder={t("auth.register.passwordPlaceholder")}
                  placeholderTextColor={c.textFaint}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  autoCapitalize="none"
                  autoCorrect={false}
                  passwordRules="minlength: 8;"
                  returnKeyType="next"
                  value={form.password}
                  onChangeText={(v) => update("password", v)}
                  onSubmitEditing={() => confirmRef.current?.focus()}
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
              {fieldErrors.password ? (
                <Text style={[styles.fieldError, { color: c.error }]}>
                  {fieldErrors.password}
                </Text>
              ) : null}
            </View>

            <Field
              ref={confirmRef}
              label={t("auth.register.confirmPassword")}
              placeholder={t("auth.register.confirmPasswordPlaceholder")}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              value={form.confirmPassword}
              error={fieldErrors.confirmPassword}
              onChangeText={(v) => update("confirmPassword", v)}
              onSubmitEditing={() => void onSubmit()}
            />

            <GlassButton
              variant="active"
              size="lg"
              loading={loading}
              onPress={() => void onSubmit()}
            >
              {loading
                ? t("auth.register.submitting")
                : t("auth.register.submit")}
            </GlassButton>

            <View style={styles.divider}>
              <View
                style={[styles.dividerLine, { backgroundColor: c.border }]}
              />
              <Text style={[styles.dividerText, { color: c.textMuted }]}>
                {t("auth.orContinueWith")}
              </Text>
              <View
                style={[styles.dividerLine, { backgroundColor: c.border }]}
              />
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
                {t("auth.register.hasAccount")}{" "}
              </Text>
              <Link href="/login">
                <Text style={[styles.bottomLink, { color: c.primary }]}>
                  {t("auth.register.loginHere")}
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

  nameRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  nameField: { flex: 1 },

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
  fieldError: {
    fontSize: typography.xs,
    marginTop: spacing.xs,
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
