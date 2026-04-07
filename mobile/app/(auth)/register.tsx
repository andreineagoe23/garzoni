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
import { obtainTokenPair, registerSecure } from "@garzoni/core";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<RNTextInput>(null);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);
  const firstRef = useRef<RNTextInput>(null);
  const lastRef = useRef<RNTextInput>(null);

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = "Username is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email.trim()))
      errs.email = "Enter a valid email address.";
    if (!form.password)
      errs.password = "This field is required."; // pragma: allowlist secret
    else if (form.password.length < 8)
      errs.password = "Use at least 8 characters."; // pragma: allowlist secret
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = "The two entries do not match."; // pragma: allowlist secret
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
        // New users go through personalisation questionnaire
        router.replace("/onboarding");
      } else {
        // Fallback to standard JWT endpoint after successful registration.
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
          setError(`No access token returned from server. Response keys: ${keys || "none"}`);
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start your financial learning journey</Text>

        <AuthBackendBanner />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormInput
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
        <FormInput
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
        <FormInput
          ref={passwordRef}
          label="Password"
          placeholder="At least 8 characters"
          secureTextEntry
          returnKeyType="next"
          value={form.password}
          error={fieldErrors.password}
          onChangeText={(v) => update("password", v)}
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <FormInput
          ref={confirmRef}
          label="Confirm password"
          placeholder="Re-enter password"
          secureTextEntry
          returnKeyType="next"
          value={form.confirmPassword}
          error={fieldErrors.confirmPassword}
          onChangeText={(v) => update("confirmPassword", v)}
          onSubmitEditing={() => firstRef.current?.focus()}
        />
        <FormInput
          ref={firstRef}
          label="First name (optional)"
          placeholder="First name"
          returnKeyType="next"
          value={form.first_name}
          onChangeText={(v) => update("first_name", v)}
          onSubmitEditing={() => lastRef.current?.focus()}
        />
        <FormInput
          ref={lastRef}
          label="Last name (optional)"
          placeholder="Last name"
          returnKeyType="done"
          value={form.last_name}
          onChangeText={(v) => update("last_name", v)}
          onSubmitEditing={() => void onSubmit()}
        />

        <Button loading={loading} onPress={() => void onSubmit()}>
          Sign up
        </Button>

        <AuthSocialSection
          onSuccess={async (access, refresh, meta) => {
            await applyTokens(access, refresh);
            replaceAfterSocialAuth(meta?.next);
          }}
          onError={(m) => setError(m)}
        />

        <Link href="/login" style={styles.bottomLink}>
          <Text style={styles.bottomLinkText}>
            Already have an account?{" "}
            <Text style={styles.bottomLinkBold}>Sign in</Text>
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
  bottomLink: { alignSelf: "center", marginTop: spacing.xxl },
  bottomLinkText: { fontSize: typography.base, color: colors.textMuted },
  bottomLinkBold: { color: colors.primary, fontWeight: "600" },
});
