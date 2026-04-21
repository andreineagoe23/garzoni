import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, router } from "expo-router";
import { obtainTokenPair, registerSecure } from "@garzoni/core";
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

type FieldKey =
  | "username"
  | "email"
  | "password"
  | "confirmPassword"
  | "first_name"
  | "last_name";

export default function RegisterScreen() {
  const { t } = useTranslation("common");
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

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const lastRef = useRef<TextInput>(null);

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

  return (
    <AuthDarkShell
      eyebrow={t("auth.register.title")}
      title={t("auth.register.subtitle")}
    >
      <AuthBackendBanner />
      <DarkErrorBanner message={error} />

      <View style={styles.nameRow}>
        <View style={styles.nameField}>
          <DarkField
            label={t("auth.register.firstName")}
            placeholder={t("auth.register.firstNamePlaceholder")}
            returnKeyType="next"
            value={form.first_name}
            onChangeText={(v) => update("first_name", v)}
            onSubmitEditing={() => lastRef.current?.focus()}
          />
        </View>
        <View style={styles.nameField}>
          <DarkField
            ref={lastRef}
            label={t("auth.register.lastName")}
            placeholder={t("auth.register.lastNamePlaceholder")}
            returnKeyType="next"
            value={form.last_name}
            onChangeText={(v) => update("last_name", v)}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        </View>
      </View>

      <DarkField
        label={t("auth.register.username")}
        placeholder={t("auth.register.usernamePlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        value={form.username}
        error={fieldErrors.username}
        onChangeText={(v) => update("username", v)}
        onSubmitEditing={() => emailRef.current?.focus()}
      />

      <DarkField
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

      <DarkField
        ref={passwordRef}
        label={t("auth.register.password")}
        placeholder={t("auth.register.passwordPlaceholder")}
        secureTextEntry={!showPassword}
        textContentType="newPassword"
        autoComplete="password-new"
        autoCapitalize="none"
        autoCorrect={false}
        passwordRules="minlength: 8;"
        returnKeyType="next"
        value={form.password}
        error={fieldErrors.password}
        onChangeText={(v) => update("password", v)}
        onSubmitEditing={() => confirmRef.current?.focus()}
        rightSlot={
          <EyeButton
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            showLabel={t("auth.login.showPassword")}
            hideLabel={t("auth.login.hidePassword")}
          />
        }
      />

      <DarkField
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

      <DarkCta
        label={
          loading ? t("auth.register.submitting") : t("auth.register.submit")
        }
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
        <Text style={styles.bottomText}>{t("auth.register.hasAccount")} </Text>
        <Link href="/login" style={styles.bottomLink}>
          {t("auth.register.loginHere")}
        </Link>
      </View>
    </AuthDarkShell>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: "row", gap: 12 },
  nameField: { flex: 1 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 22,
  },
  bottomText: { fontSize: 13, color: DARK.muted },
  bottomLink: { fontSize: 13, color: DARK.primaryBright, fontWeight: "600" },
});
