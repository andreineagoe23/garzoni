import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, router } from "expo-router";
import { loginSecure, obtainTokenPair } from "@garzoni/core";
import { useTranslation } from "react-i18next";
import { useAuthSession } from "../../src/auth/AuthContext";
import { replaceAfterSocialAuth } from "../../src/auth/replaceAfterSocialAuth";
import { formatAuthRequestError } from "../../src/auth/authErrorMessage";
import AuthBackendBanner from "../../src/components/AuthBackendBanner";
import { AuthSocialSection } from "../../src/components/AuthSocialSection";
import AuthDarkShell, {
  DARK,
  DarkCta,
  DarkDivider,
  DarkErrorBanner,
  DarkField,
  EyeButton,
} from "../../src/components/auth/AuthDarkShell";

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
  const { applyTokens } = useAuthSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);

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
      setError(formatAuthRequestError(e, t("auth.login.loginFailed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthDarkShell
      eyebrow={t("auth.login.title")}
      title={t("auth.login.subtitle")}
    >
      <AuthBackendBanner />
      <DarkErrorBanner message={error} />

      <DarkField
        label={t("auth.login.username")}
        placeholder={t("auth.login.usernamePlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="next"
        value={username}
        onChangeText={setUsername}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />

      <DarkField
        ref={passwordRef}
        label={t("auth.login.password")}
        placeholder={t("auth.login.passwordPlaceholder")}
        secureTextEntry={!showPassword}
        textContentType="password"
        autoComplete="password"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={() => void onSubmit()}
        rightSlot={
          <EyeButton
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            showLabel={t("auth.login.showPassword")}
            hideLabel={t("auth.login.hidePassword")}
          />
        }
      />

      <Link href="/(auth)/forgot-password" asChild>
        <Pressable hitSlop={8} style={styles.forgotWrap}>
          <Text style={styles.forgot}>{t("auth.login.forgotPassword")}</Text>
        </Pressable>
      </Link>

      <DarkCta
        label={loading ? t("auth.login.submitting") : t("auth.login.submit")}
        loading={loading}
        onPress={() => void onSubmit()}
      />

      <DarkDivider label={t("auth.orContinueWith")} />

      <AuthSocialSection
        onSuccess={async (access, refresh, meta) => {
          await applyTokens(access, refresh);
          replaceAfterSocialAuth(meta?.next);
        }}
        onError={(m) => setError(m)}
      />

      <View style={styles.bottomRow}>
        <Text style={styles.bottomText}>{t("auth.login.noAccount")} </Text>
        <Link href="/register" style={styles.bottomLink}>
          {t("auth.login.signUpNow")}
        </Link>
      </View>
    </AuthDarkShell>
  );
}

const styles = StyleSheet.create({
  forgotWrap: { alignSelf: "flex-end", marginTop: 2, marginBottom: 6 },
  forgot: { fontSize: 13, color: DARK.primaryBright, fontWeight: "600" },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 22,
  },
  bottomText: { fontSize: 13, color: DARK.muted },
  bottomLink: { fontSize: 13, color: DARK.primaryBright, fontWeight: "600" },
});
