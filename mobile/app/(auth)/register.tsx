import { useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { obtainTokenPair, registerSecure } from "@garzoni/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import { replaceAfterSocialAuth } from "../../src/auth/replaceAfterSocialAuth";
import { formatAuthRequestError } from "../../src/auth/authErrorMessage";
import AuthBackendBanner from "../../src/components/AuthBackendBanner";
import { AuthSocialSection } from "../../src/components/AuthSocialSection";
import { radius, spacing, typography } from "../../src/theme/tokens";

const brand = {
  primary: "#1d5330",
  primaryPressed: "#163d26",
  accent: "#ffd700",
  text: "#111827",
  textMuted: "#6b7280",
  textLabel: "#374151",
  border: "#e5e7eb",
  inputBg: "#ffffff",
  error: "#dc2626",
  errorBg: "rgba(220,38,38,0.1)",
  errorBorder: "rgba(220,38,38,0.4)",
  glassFill: "rgba(255,255,255,0.95)",
  overlay: "rgba(0,0,0,0.60)",
};

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

export default function RegisterScreen() {
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
    if (!form.username.trim()) errs.username = "Username is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email.trim()))
      errs.email = "Enter a valid email address.";
    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 8)
      errs.password = "Use at least 8 characters.";
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = "The two entries do not match.";
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
        router.replace("/onboarding");
      } else {
        const fallback = await obtainTokenPair({
          username: form.username.trim(),
          password: form.password,
        });
        const fallbackAccess = fallback.data?.access;
        if (fallbackAccess) {
          await applyTokens(fallbackAccess, fallback.data?.refresh);
          router.replace("/onboarding");
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
        setError(formatAuthRequestError(e, "Could not register."));
      } else {
        const detail = err.response?.data?.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (err.response?.data) {
          const msgs = Object.entries(err.response.data)
            .filter(([k]) => k !== "detail")
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join("\n");
          setError(msgs || "Could not register.");
        } else {
          setError("Could not register.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <Image
        source={require("../../assets/register-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <Image
              source={require("../../assets/garzoni-logo.png")}
              style={styles.logoMark}
              resizeMode="contain"
            />
            <Image
              source={require("../../assets/garzoni-text.png")}
              style={styles.logoText}
              resizeMode="contain"
            />
          </View>

          {/* Glass card */}
          <View style={styles.card}>
            <AuthBackendBanner />

            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Start your financial learning journey
            </Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* First + Last name row */}
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={styles.label}>First name</Text>
                <RNTextInput
                  ref={firstRef}
                  style={styles.input}
                  placeholder="First"
                  placeholderTextColor={brand.textMuted}
                  returnKeyType="next"
                  value={form.first_name}
                  onChangeText={(v) => update("first_name", v)}
                  onSubmitEditing={() => lastRef.current?.focus()}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={styles.label}>Last name</Text>
                <RNTextInput
                  ref={lastRef}
                  style={styles.input}
                  placeholder="Last"
                  placeholderTextColor={brand.textMuted}
                  returnKeyType="next"
                  value={form.last_name}
                  onChangeText={(v) => update("last_name", v)}
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <Field
              label="Username"
              placeholder="Choose a username"
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
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              value={form.email}
              error={fieldErrors.email}
              onChangeText={(v) => update("email", v)}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            {/* Password with show/hide */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <RNTextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    fieldErrors.password && styles.inputError,
                  ]}
                  placeholder="At least 8 characters"
                  placeholderTextColor={brand.textMuted}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  value={form.password}
                  onChangeText={(v) => update("password", v)}
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                >
                  <Text style={styles.eyeText}>
                    {showPassword ? "🙈" : "👁"}
                  </Text>
                </Pressable>
              </View>
              {fieldErrors.password ? (
                <Text style={styles.fieldError}>{fieldErrors.password}</Text>
              ) : null}
            </View>

            <Field
              ref={confirmRef}
              label="Confirm password"
              placeholder="Re-enter password"
              secureTextEntry
              returnKeyType="done"
              value={form.confirmPassword}
              error={fieldErrors.confirmPassword}
              onChangeText={(v) => update("confirmPassword", v)}
              onSubmitEditing={() => void onSubmit()}
            />

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
                loading && styles.primaryBtnDisabled,
              ]}
              onPress={() => void onSubmit()}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? "Creating account…" : "Sign up"}
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <AuthSocialSection
              onSuccess={async (access, refresh, meta) => {
                await applyTokens(access, refresh);
                replaceAfterSocialAuth(meta?.next);
              }}
              onError={(m) => setError(m)}
            />

            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>Already have an account? </Text>
              <Link href="/login">
                <Text style={styles.bottomLink}>Sign in</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Small inline field component to avoid repetition
import { forwardRef } from "react";
import type { TextInputProps } from "react-native";

const Field = forwardRef<
  RNTextInput,
  TextInputProps & { label: string; error?: string }
>(({ label, error, ...rest }, ref) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <RNTextInput
      ref={ref}
      style={[styles.input, error && styles.inputError]}
      placeholderTextColor={brand.textMuted}
      {...rest}
    />
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
));
Field.displayName = "Field";

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  overlay: { backgroundColor: brand.overlay },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: 60,
    paddingBottom: spacing.xxxxl,
  },

  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxl,
    gap: 10,
  },
  logoMark: { width: 36, height: 36 },
  logoText: { width: 110, height: 28 },

  card: {
    backgroundColor: brand.glassFill,
    borderRadius: 24,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },

  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: brand.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sm,
    color: brand.textMuted,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },

  errorBanner: {
    backgroundColor: brand.errorBg,
    borderWidth: 1,
    borderColor: brand.errorBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: brand.error, fontSize: typography.sm },

  // Name row (2 columns like web)
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
    color: brand.textLabel,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    fontSize: typography.base,
    color: brand.text,
    backgroundColor: brand.inputBg,
  },
  inputError: { borderColor: brand.error },
  fieldError: {
    fontSize: typography.xs,
    color: brand.error,
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
  eyeText: { fontSize: 16 },

  primaryBtn: {
    backgroundColor: brand.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  primaryBtnPressed: { backgroundColor: brand.primaryPressed },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: typography.base,
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
    backgroundColor: brand.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.xs,
    color: brand.textMuted,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  bottomText: { fontSize: typography.sm, color: brand.textMuted },
  bottomLink: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: brand.primary,
  },
});
