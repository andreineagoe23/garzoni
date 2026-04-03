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
import { loginSecure } from "@monevo/core";
import { useAuthSession } from "../../src/auth/AuthContext";
import { GoogleSignInButton } from "../../src/components/GoogleSignInButton";
import { Button, FormInput } from "../../src/components/ui";
import { colors, spacing, typography, radius } from "../../src/theme/tokens";

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
      if (data?.access) {
        await applyTokens(data.access, data.refresh);
        router.replace("/(tabs)");
      } else {
        setError("No access token returned.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Could not sign in. Check your credentials."
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <GoogleSignInButton
          onSuccess={async (access, refresh) => {
            await applyTokens(access, refresh);
            router.replace("/(tabs)");
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
  container: { padding: spacing.xxl, paddingTop: spacing.xxxxl },
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.xxl,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerLabel: {
    marginHorizontal: spacing.md,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  bottomLink: { alignSelf: "center", marginTop: spacing.xxl },
  bottomLinkText: { fontSize: typography.base, color: colors.textMuted },
  bottomLinkBold: { color: colors.primary, fontWeight: "600" },
});
