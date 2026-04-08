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
import { loginSecure, obtainTokenPair } from "@garzoni/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import { replaceAfterSocialAuth } from "../../src/auth/replaceAfterSocialAuth";
import { formatAuthRequestError } from "../../src/auth/authErrorMessage";
import AuthBackendBanner from "../../src/components/AuthBackendBanner";
import { AuthSocialSection } from "../../src/components/AuthSocialSection";
import { FormInput } from "../../src/components/ui";
import { radius, spacing, typography } from "../../src/theme/tokens";

// Brand tokens matching the web auth screens
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

export default function LoginScreen() {
  const { applyTokens } = useAuthSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<RNTextInput>(null);

  const onSubmit = async () => {
    setError("");
    if (!username.trim()) { setError("Username is required."); return; }
    if (!password) { setError("Password is required."); return; }
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
        router.replace("/(tabs)");
      } else {
        const fallback = await obtainTokenPair({ username: username.trim(), password });
        const fallbackAccess = fallback.data?.access;
        if (fallbackAccess) {
          await applyTokens(fallbackAccess, fallback.data?.refresh);
          router.replace("/(tabs)");
        } else {
          const keys = data && typeof data === "object"
            ? Object.keys(data as Record<string, unknown>).join(", ")
            : typeof data;
          setError(`No access token returned from server. Response keys: ${keys || "none"}`);
        }
      }
    } catch (e: unknown) {
      setError(formatAuthRequestError(e, "Could not sign in. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Full-screen background image */}
      <Image
        source={require("../../assets/login-bg.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {/* Dark overlay matching web's bg-black/60 */}
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

            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue learning</Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Username */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Username</Text>
              <RNTextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor={brand.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="next"
                value={username}
                onChangeText={setUsername}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <RNTextInput
                  ref={passwordRef}
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
                  placeholderTextColor={brand.textMuted}
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
                >
                  <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁"}</Text>
                </Pressable>
              </View>
            </View>

            {/* Forgot password */}
            <Link href="/(auth)/forgot-password" style={styles.forgotWrap}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Link>

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed, loading && styles.primaryBtnDisabled]}
              onPress={() => void onSubmit()}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? "Signing in…" : "Sign in"}
              </Text>
            </Pressable>

            {/* Divider */}
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
              <Text style={styles.bottomText}>Don't have an account? </Text>
              <Link href="/register">
                <Text style={styles.bottomLink}>Sign up</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

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

  // Logo
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxl,
    gap: 10,
  },
  logoMark: { width: 36, height: 36 },
  logoText: { width: 110, height: 28 },

  // Glass card — matches web GlassCard: white/95, rounded-3xl, backdrop blur
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

  // Error banner
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

  // Fields
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

  // Forgot
  forgotWrap: { alignSelf: "flex-end", marginBottom: spacing.lg },
  forgotText: {
    fontSize: typography.sm,
    fontWeight: "600",
    color: brand.primary,
  },

  // Primary button — pill, forest green, full width
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

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xl,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: brand.border },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.xs,
    color: brand.textMuted,
  },

  // Bottom link
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  bottomText: { fontSize: typography.sm, color: brand.textMuted },
  bottomLink: { fontSize: typography.sm, fontWeight: "600", color: brand.primary },
});
