import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, router } from "expo-router";
import { registerSecure } from "@garzoni/core";
import { useTranslation } from "react-i18next";
import { useAuthSession } from "../../src/auth/AuthContext";
import { replaceAfterSocialAuth } from "../../src/auth/replaceAfterSocialAuth";
import { formatAuthRequestError } from "../../src/auth/authErrorMessage";
import { consumePendingReferralCode } from "../../src/auth/pendingReferral";
import AuthBackendBanner from "../../src/components/AuthBackendBanner";
import { AuthSocialSection } from "../../src/components/AuthSocialSection";
import { trackEvent } from "../../src/lib/analytics";
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

// Two-step signup: step 1 = credentials + consents, step 2 = optional names.
// Confirm-password was dropped in favor of the show-password toggle; the
// backend auto-generates the username, so none is collected or sent.
type Step = 1 | 2;

type FieldKey = "email" | "password" | "first_name" | "last_name";

function ConsentRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.consentRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <View style={styles.consentTextWrap}>{children}</View>
    </Pressable>
  );
}

function StepDots({ step }: { step: Step }) {
  const { t } = useTranslation("common");
  return (
    <View
      style={styles.dotsRow}
      accessibilityLabel={t("auth.register.stepIndicator", {
        current: step,
        total: 2,
      })}
    >
      {([1, 2] as const).map((i) => (
        <View
          key={i}
          style={[styles.dot, step === i ? styles.dotActive : null]}
        />
      ))}
    </View>
  );
}

export default function RegisterScreen() {
  const { t } = useTranslation("common");
  const { applyTokens } = useAuthSession();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const canContinue = acceptTerms && ageConfirmed;
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldKey, string>>
  >({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const lastRef = useRef<TextInput>(null);

  // Per-step funnel visibility (signup completion rate instrumentation).
  useEffect(() => {
    trackEvent("register_step_view", { step });
  }, [step]);

  const update = (key: FieldKey, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateStepOne = (): boolean => {
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!form.email.trim()) errs.email = t("auth.validation.emailRequired");
    else if (!/\S+@\S+\.\S+/.test(form.email.trim()))
      errs.email = t("auth.validation.emailInvalid");
    if (!form.password) errs.password = t("auth.validation.passwordRequired");
    else if (form.password.length < 8)
      errs.password = t("auth.validation.passwordMinLength");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onContinue = () => {
    setError("");
    if (!canContinue) {
      setError(t("auth.register.acceptToContinue"));
      return;
    }
    if (!validateStepOne()) return;
    trackEvent("register_step_continue", { step: 1 });
    setStep(2);
  };

  const onSubmit = async (skipNames: boolean) => {
    setError("");
    setLoading(true);
    trackEvent("register_step_continue", { step: 2, skipped_names: skipNames });
    try {
      const referralCode = await consumePendingReferralCode();
      const firstName = skipNames ? "" : form.first_name.trim();
      const lastName = skipNames ? "" : form.last_name.trim();
      // No username: the backend auto-generates one from the email local-part.
      // Names go up only when provided.
      const { data } = await registerSecure({
        email: form.email.trim(),
        password: form.password,
        client_type: "mobile",
        platform: "mobile",
        accept_terms: true,
        age_confirmed: true,
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        ...(referralCode ? { referral_code: referralCode } : {}),
      });
      const { access, refresh } = extractTokens(data as TokenResponseLike);
      if (access) {
        await applyTokens(access, refresh);
        router.replace("/");
      } else {
        setError(t("auth.register.registerFailed"));
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
        // Server-side rejections (e.g. email already in use) concern step-1
        // fields — bring the user back where they can fix them.
        setStep(1);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthDarkShell
      eyebrow={t("auth.register.title")}
      title={
        step === 1 ? t("auth.register.subtitle") : t("auth.register.step2Title")
      }
      subtitle={step === 2 ? t("auth.register.step2Hint") : undefined}
    >
      <AuthBackendBanner />
      <DarkErrorBanner message={error} />

      <StepDots step={step} />

      {step === 1 ? (
        <>
          <DarkField
            label={t("auth.register.email")}
            placeholder={t("auth.register.emailPlaceholder")}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
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
            returnKeyType="done"
            value={form.password}
            error={fieldErrors.password}
            onChangeText={(v) => update("password", v)}
            onSubmitEditing={onContinue}
            rightSlot={
              <EyeButton
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                showLabel={t("auth.login.showPassword")}
                hideLabel={t("auth.login.hidePassword")}
              />
            }
          />

          <ConsentRow
            checked={acceptTerms}
            onToggle={() => setAcceptTerms((v) => !v)}
          >
            <Text style={styles.consentText}>
              {t("auth.register.agreePrefix")}{" "}
              <Text
                style={styles.consentLink}
                onPress={() => router.push("/legal/terms")}
              >
                {t("auth.register.termsLink")}
              </Text>
              {t("auth.register.agreeJoin")}{" "}
              <Text
                style={styles.consentLink}
                onPress={() => router.push("/legal/privacy")}
              >
                {t("auth.register.privacyLink")}
              </Text>
              .
            </Text>
          </ConsentRow>

          <ConsentRow
            checked={ageConfirmed}
            onToggle={() => setAgeConfirmed((v) => !v)}
          >
            <Text style={styles.consentText}>
              {t("auth.register.ageConfirm")}
            </Text>
          </ConsentRow>

          <DarkCta
            label={t("auth.register.continueStep")}
            disabled={!canContinue}
            onPress={onContinue}
          />

          <DarkDivider label={t("auth.orContinueWith")} />

          {/* Social sign-in is tap-to-consent (like the login screen): tapping
              the button accepts Terms/Privacy + 16+, with the notice below as
              the legal basis. The checkboxes above only gate the email form. */}
          <AuthSocialSection
            consent={{ accept_terms: true, age_confirmed: true }}
            onSuccess={async (access, refresh, meta) => {
              await applyTokens(access, refresh);
              replaceAfterSocialAuth(meta?.next);
            }}
            onError={(m) => setError(m)}
          />

          <Text style={styles.socialTerms}>
            {t("auth.socialTermsPrefix")}{" "}
            <Text
              style={styles.socialTermsLink}
              onPress={() => router.push("/legal/terms")}
            >
              {t("auth.register.termsLink")}
            </Text>
            {t("auth.register.agreeJoin")}{" "}
            <Text
              style={styles.socialTermsLink}
              onPress={() => router.push("/legal/privacy")}
            >
              {t("auth.register.privacyLink")}
            </Text>
            .
          </Text>

          <View style={styles.bottomRow}>
            <Text style={styles.bottomText}>
              {t("auth.register.hasAccount")}{" "}
            </Text>
            <Link href="/login" style={styles.bottomLink}>
              {t("auth.register.loginHere")}
            </Link>
          </View>
        </>
      ) : (
        <>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <DarkField
                label={t("auth.register.firstName")}
                placeholder={t("auth.register.firstNamePlaceholder")}
                returnKeyType="next"
                autoFocus
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
                returnKeyType="done"
                value={form.last_name}
                onChangeText={(v) => update("last_name", v)}
                onSubmitEditing={() => void onSubmit(false)}
              />
            </View>
          </View>

          <DarkCta
            label={
              loading
                ? t("auth.register.submitting")
                : t("auth.register.submit")
            }
            loading={loading}
            onPress={() => void onSubmit(false)}
          />

          <Pressable
            onPress={() => void onSubmit(true)}
            disabled={loading}
            accessibilityRole="button"
            style={styles.skipBtn}
            hitSlop={8}
          >
            <Text style={styles.skipLabel}>{t("auth.register.skipNames")}</Text>
          </Pressable>

          <Pressable
            onPress={() => setStep(1)}
            disabled={loading}
            accessibilityRole="button"
            style={styles.backBtn}
            hitSlop={8}
          >
            <Text style={styles.backLabel}>{t("auth.register.backStep")}</Text>
          </Pressable>
        </>
      )}
    </AuthDarkShell>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: "row", gap: 12 },
  nameField: { flex: 1 },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DARK.ghost,
  },
  dotActive: {
    width: 22,
    backgroundColor: DARK.primaryBright,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 10,
  },
  bottomText: { fontSize: 13, color: DARK.muted },
  bottomLink: { fontSize: 13, color: DARK.primaryBright, fontWeight: "600" },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: DARK.muted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: DARK.primaryBright,
    borderColor: DARK.primaryBright,
  },
  checkboxMark: { color: "#04110a", fontSize: 14, fontWeight: "800" },
  consentTextWrap: { flex: 1 },
  consentText: { fontSize: 13, color: DARK.muted, lineHeight: 19 },
  consentLink: { color: DARK.primaryBright, fontWeight: "600" },
  skipBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: { color: DARK.muted, fontSize: 14, fontWeight: "500" },
  backBtn: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backLabel: { color: DARK.faint, fontSize: 13, fontWeight: "500" },
  socialTerms: {
    fontSize: 12,
    lineHeight: 17,
    color: DARK.muted,
    textAlign: "center",
    marginTop: 12,
  },
  socialTermsLink: { color: DARK.primaryBright, fontWeight: "600" },
});
