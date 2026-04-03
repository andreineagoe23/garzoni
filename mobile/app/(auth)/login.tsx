import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { loginSecure, obtainTokenPair } from "@monevo/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import { replaceAfterSocialAuth } from "../../src/auth/replaceAfterSocialAuth";
import { formatAuthRequestError } from "../../src/auth/authErrorMessage";
import AuthBackendBanner from "../../src/components/AuthBackendBanner";
import { AuthSocialSection } from "../../src/components/AuthSocialSection";
import { Button, FormInput } from "../../src/components/ui";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<RNTextInput>(null);

  const onSubmit = async () => {
    setError("");
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
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
        router.replace("/(tabs)");
      } else {
        // Fallback for environments where /login-secure/ response shape is customized.
        const fallback = await obtainTokenPair({
          username: username.trim(),
          password,
        });
        const fallbackAccess = fallback.data?.access;
        if (fallbackAccess) {
          await applyTokens(fallbackAccess, fallback.data?.refresh);
          router.replace("/(tabs)");
        } else {
          const keys =
            data && typeof data === "object"
              ? Object.keys(data as Record<string, unknown>).join(", ")
              : typeof data;
          setError(`No access token returned from server. Response keys: ${keys || "none"}`);
        }
      }
    } catch (e: unknown) {
      setError(
        formatAuthRequestError(e, "Could not sign in. Check your credentials.")
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
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue learning</Text>

        <AuthBackendBanner />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormInput
          label="Username"
          placeholder="Enter your username"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="next"
          value={username}
          onChangeText={setUsername}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        <FormInput
          ref={passwordRef}
          label="Password"
          placeholder="Enter your password"
          secureTextEntry
          returnKeyType="done"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void onSubmit()}
        />

        <Button loading={loading} onPress={() => void onSubmit()}>
          Sign in
        </Button>

        <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Link>

        <AuthSocialSection
          onSuccess={async (access, refresh, meta) => {
            await applyTokens(access, refresh);
            replaceAfterSocialAuth(meta?.next);
          }}
          onError={(m) => setError(m)}
        />

        <Link href="/register" style={styles.bottomLink}>
          <Text style={styles.bottomLinkText}>
            Don't have an account?{" "}
            <Text style={styles.bottomLinkBold}>Sign up</Text>
          </Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xxl,
    paddingBottom: spacing.xxxxl,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
  },
  errorBanner: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: typography.sm },
  forgotLink: { alignSelf: "center", marginTop: spacing.lg },
  forgotText: { color: colors.primary, fontSize: typography.sm },
  bottomLink: { alignSelf: "center", marginTop: spacing.xxl },
  bottomLinkText: { fontSize: typography.base, color: colors.textMuted },
  bottomLinkBold: { color: colors.primary, fontWeight: "600" },
});
