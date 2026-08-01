import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Helmet } from "react-helmet-async";
import { Trans, useTranslation } from "react-i18next";
import { isAxiosError } from "@garzoni/core";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "components/layout/Header";
import { useAuth } from "contexts/AuthContext";
import { useRecaptcha } from "contexts/RecaptchaContext";
import { GlassButton } from "components/ui";
import apiClient from "services/httpClient";
import { recordFunnelEvent } from "services/analyticsService";
import { buildGoogleOAuthInitHref } from "utils/buildGoogleOAuthInitHref";
import RecaptchaVerifyingModal from "components/auth/RecaptchaVerifyingModal";
import { peekPendingReferralCode } from "utils/pendingReferral";
import FormNotice from "components/common/FormNotice";

// TODO(i18n): step-2 / OAuth-caption copy below is hardcoded English pending
// translation keys in packages/core (repo i18n test forbids unknown t() keys).

type ReferralValidationState = "idle" | "checking" | "valid" | "invalid";
type RegisterStep = 1 | 2;

const TOTAL_STEPS = 2;

/**
 * Two-step registration (UX plan 2.1):
 *   Step 1 — email + password + required consents (+ marketing opt-in).
 *   Step 2 — optional names + collapsed invite-code disclosure; skippable.
 * Account creation happens on step-2 submit (or Skip). Username is never sent;
 * the backend auto-generates one and treats first/last name as optional.
 */
function Register() {
  const { t } = useTranslation();
  const location = useLocation();
  const initialReferral = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("ref") || "";
    return fromQuery || peekPendingReferralCode();
  }, [location.search]);
  const [step, setStep] = useState<RegisterStep>(1);
  const [formData, setFormData] = useState({
    password: "",
    email: "",
    first_name: "",
    last_name: "",
    referral_code: initialReferral,
  });
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const canSubmit = acceptTerms && ageConfirmed;
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyingModal, setShowVerifyingModal] = useState(false);
  // Invite-code disclosure starts open when a code arrived via ?ref= / pending referral.
  const [showReferralField, setShowReferralField] = useState(
    Boolean(initialReferral)
  );
  const [referralValidationState, setReferralValidationState] =
    useState<ReferralValidationState>("idle");
  const [referralValidationMessage, setReferralValidationMessage] =
    useState("");

  const navigate = useNavigate();
  const { registerUser } = useAuth();
  const { executeRecaptcha } = useRecaptcha();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Funnel instrumentation: one view event per step shown.
  const trackedStepsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (trackedStepsRef.current.has(step)) return;
    trackedStepsRef.current.add(step);
    Promise.resolve(
      recordFunnelEvent("register_step_view", {
        metadata: { step, total_steps: TOTAL_STEPS },
      })
    ).catch(() => {});
  }, [step]);

  const validateReferralCode = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = rawCode.trim();
      if (!code) {
        setReferralValidationState("idle");
        setReferralValidationMessage("");
        return true;
      }

      setReferralValidationState("checking");
      setReferralValidationMessage("");
      try {
        const response = await apiClient.get("/referrals/validate/", {
          params: { code },
          skipAuthRedirect: true,
        });
        const isValid = Boolean(response.data?.valid);
        if (isValid) {
          setReferralValidationState("valid");
          setReferralValidationMessage(t("auth.register.referralCodeValid"));
          return true;
        }
        setReferralValidationState("invalid");
        setReferralValidationMessage(
          response.data?.message || t("auth.register.referralCodeInvalid")
        );
        return false;
      } catch {
        setReferralValidationState("invalid");
        setReferralValidationMessage(
          t("auth.register.referralCodeCheckFailed")
        );
        return false;
      }
    },
    [t]
  );

  useEffect(() => {
    const code = formData.referral_code.trim();
    if (!code) {
      setReferralValidationState("idle");
      setReferralValidationMessage("");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void validateReferralCode(code);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [formData.referral_code, validateReferralCode]);

  const handleContinueToStep2 = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setErrorMessage(t("auth.register.acceptToContinue"));
      return;
    }
    setErrorMessage("");
    setErrorCode(undefined);
    Promise.resolve(
      recordFunnelEvent("register_step_continue", {
        metadata: { step: 1, total_steps: TOTAL_STEPS },
      })
    ).catch(() => {});
    setStep(2);
  };

  /**
   * Create the account. `includeOptional=false` is the "Skip" path — only the
   * step-1 fields are sent. Never sends `username`; the backend generates it.
   */
  const submitRegistration = async (includeOptional: boolean) => {
    setIsLoading(true);
    setErrorMessage("");
    setErrorCode(undefined);

    const referralCode = includeOptional ? formData.referral_code.trim() : "";
    if (referralCode) {
      const isReferralValid = await validateReferralCode(referralCode);
      if (!isReferralValid) {
        setErrorMessage(t("auth.register.referralCodeInvalid"));
        setIsLoading(false);
        return;
      }
    }

    const runRegister = async (payload: Record<string, unknown>) => {
      const result = await registerUser(payload);
      if (result.success) {
        navigate("/onboarding", { replace: true });
      } else {
        setErrorMessage(result.error || t("auth.register.registerFailed"));
        setErrorCode(result.code);
      }
      return result;
    };

    try {
      let token = "";
      if (executeRecaptcha) {
        setShowVerifyingModal(true);
        try {
          token = await executeRecaptcha("register");
        } finally {
          setShowVerifyingModal(false);
        }
      }
      const firstName = includeOptional ? formData.first_name.trim() : "";
      const lastName = includeOptional ? formData.last_name.trim() : "";
      const payload: Record<string, unknown> = {
        email: formData.email,
        password: formData.password,
        marketing_opt_in: marketingOptIn,
        accept_terms: acceptTerms,
        age_confirmed: ageConfirmed,
        recaptcha_token: token,
      };
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      if (referralCode) payload.referral_code = referralCode;
      const result = await runRegister(payload);
      if (result.success) return;
    } catch (registerError) {
      if (isAxiosError(registerError)) {
        const data = registerError.response?.data;
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : typeof data?.error === "string"
              ? data.error
              : registerError.response
                ? registerError.message
                : t("auth.register.networkError") || undefined;
        setErrorMessage(detail || t("auth.register.registerFailed"));
        setErrorCode(data?.code);
      } else {
        const msg =
          registerError instanceof Error
            ? registerError.message
            : t("auth.register.registerFailed");
        setErrorMessage(
          /recaptcha|verification|security/i.test(msg)
            ? t("auth.register.verificationFailedHint")
            : msg
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    Promise.resolve(
      recordFunnelEvent("register_step_continue", {
        metadata: { step: 2, total_steps: TOTAL_STEPS, skipped: false },
      })
    ).catch(() => {});
    await submitRegistration(true);
  };

  const handleSkipStep2 = async () => {
    if (isLoading) return;
    Promise.resolve(
      recordFunnelEvent("register_step_continue", {
        metadata: { step: 2, total_steps: TOTAL_STEPS, skipped: true },
      })
    ).catch(() => {});
    await submitRegistration(false);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const checkboxClassName =
    "mt-0.5 h-4 w-4 shrink-0 rounded border-[color:var(--color-border-default)] text-[color:var(--color-brand-primary)] focus:ring-[color:var(--color-brand-primary)]/30";

  const progressDots = (
    <div
      className="flex items-center justify-center gap-2"
      role="group"
      aria-label={`Step ${step} of ${TOTAL_STEPS}`}
    >
      {[1, 2].map((dot) => (
        <span
          key={dot}
          aria-hidden="true"
          className={`h-2 rounded-full transition-all duration-300 ${
            dot === step
              ? "w-6 bg-[color:var(--color-brand-primary)]"
              : "w-2 bg-[color:var(--color-border-default)]"
          }`}
        />
      ))}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Create Account | Garzoni</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <RecaptchaVerifyingModal open={showVerifyingModal} />
      <Header />
      <div className="auth-ambient relative flex min-h-dvh flex-col overflow-hidden bg-[#f4ede2] dark:bg-[#0b0f14]">
        <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-12 pt-[110px] sm:px-8 lg:px-10">
          <div className="app-card app-card--pad-lg w-full max-w-md">
            <div className="space-y-3 text-center">
              <h2 className="app-display text-3xl text-content-primary">
                {t("auth.register.title")}
              </h2>
              <p className="text-sm text-content-muted">
                {step === 1
                  ? t("auth.register.subtitle")
                  : "Almost there — tell us a bit about yourself (optional)."}
              </p>
              {progressDots}
            </div>

            {errorMessage && (
              <FormNotice variant="error" className="mt-6 space-y-2">
                <p>{errorMessage}</p>
                {errorCode && (
                  <p className="text-xs opacity-80">Error code: {errorCode}</p>
                )}
                {(errorMessage.includes("Security verification") ||
                  errorMessage.includes("recaptcha") ||
                  errorMessage.includes("Verification") ||
                  errorCode === "recaptcha_missing" ||
                  errorCode === "recaptcha_failed") && (
                  <p className="text-xs opacity-90">
                    {t("auth.register.tryGoogleHint")}
                  </p>
                )}
              </FormNotice>
            )}

            {step === 1 && (
              <form onSubmit={handleContinueToStep2} className="mt-8 space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-content-muted"
                  >
                    {t("auth.register.email")}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    placeholder={t("auth.register.emailPlaceholder")}
                    className="app-input"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-content-muted"
                  >
                    {t("auth.register.password")}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                      placeholder={t("auth.register.passwordPlaceholder")}
                      className="app-input pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-content-muted transition hover:text-[color:var(--color-brand-primary)]"
                      aria-label={
                        showPassword
                          ? t("auth.login.hidePassword")
                          : t("auth.login.showPassword")
                      }
                    >
                      {showPassword ? (
                        <EyeSlash size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <label
                  htmlFor="accept_terms"
                  className="app-surface-subtle flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 text-sm text-content-muted"
                >
                  <input
                    id="accept_terms"
                    name="accept_terms"
                    type="checkbox"
                    required
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className={checkboxClassName}
                  />
                  <span>
                    <Trans
                      i18nKey="auth.register.acceptTerms"
                      components={{
                        terms: (
                          <a
                            href="/terms-of-service"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Terms of Service
                          </a>
                        ),
                        privacy: (
                          <a
                            href="/privacy-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Privacy Policy
                          </a>
                        ),
                      }}
                    />
                  </span>
                </label>

                <label
                  htmlFor="age_confirmed"
                  className="app-surface-subtle flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 text-sm text-content-muted"
                >
                  <input
                    id="age_confirmed"
                    name="age_confirmed"
                    type="checkbox"
                    required
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    className={checkboxClassName}
                  />
                  <span>{t("auth.register.ageConfirm")}</span>
                </label>

                <label
                  htmlFor="marketing_opt_in"
                  className="app-surface-subtle flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 text-sm text-content-muted"
                >
                  <input
                    id="marketing_opt_in"
                    name="marketing_opt_in"
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className={checkboxClassName}
                  />
                  <span>{t("auth.register.marketingOptIn")}</span>
                </label>

                <div className="space-y-3">
                  <GlassButton
                    type="submit"
                    disabled={!canSubmit}
                    variant="primary"
                    className="w-full"
                  >
                    Continue →
                  </GlassButton>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="app-divider w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-surface-card px-2 text-content-muted">
                        {t("auth.orContinueWith")}
                      </span>
                    </div>
                  </div>
                  {/* Tap-to-consent Google sign-up: the tap is the consent action
                      (caption below states the terms), so the button is never
                      gated behind the checkboxes. Consent also travels in the
                      OAuth state payload, mirroring the mobile pattern. */}
                  <a
                    href={buildGoogleOAuthInitHref("onboarding", {
                      consent: true,
                    })}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm font-medium text-content-primary transition hover:bg-black/[0.06] hover:border-black/15 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] dark:hover:border-white/15"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t("auth.signInWithGoogle")}
                  </a>
                  <p className="text-center text-[11px] text-content-muted">
                    By continuing you agree to our{" "}
                    <a
                      href="/terms-of-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Terms
                    </a>{" "}
                    &amp;{" "}
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Privacy Policy
                    </a>{" "}
                    and confirm you&apos;re 16+.
                  </p>
                </div>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleRegister} className="mt-8 space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="first_name"
                      className="text-sm font-medium text-content-muted"
                    >
                      {t("auth.register.firstName")}{" "}
                      <span className="text-gray-400">
                        ({t("auth.register.optional")})
                      </span>
                    </label>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      value={formData.first_name}
                      onChange={handleChange}
                      autoComplete="given-name"
                      placeholder={t("auth.register.firstNamePlaceholder")}
                      className="app-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="last_name"
                      className="text-sm font-medium text-content-muted"
                    >
                      {t("auth.register.lastName")}{" "}
                      <span className="text-gray-400">
                        ({t("auth.register.optional")})
                      </span>
                    </label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      value={formData.last_name}
                      onChange={handleChange}
                      autoComplete="family-name"
                      placeholder={t("auth.register.lastNamePlaceholder")}
                      className="app-input"
                    />
                  </div>
                </div>

                {!showReferralField ? (
                  <button
                    type="button"
                    onClick={() => setShowReferralField(true)}
                    className="text-sm font-medium text-[color:var(--color-brand-primary)] underline-offset-2 transition hover:underline"
                  >
                    Have an invite code?
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label
                      htmlFor="referral_code"
                      className="text-sm font-medium text-content-muted"
                    >
                      {t("auth.register.referralCode")}{" "}
                      <span className="text-gray-400">
                        ({t("auth.register.optional")})
                      </span>
                    </label>
                    <input
                      id="referral_code"
                      name="referral_code"
                      type="text"
                      value={formData.referral_code}
                      onChange={handleChange}
                      onBlur={() => {
                        void validateReferralCode(formData.referral_code);
                      }}
                      placeholder={t("auth.register.referralPlaceholder")}
                      className="app-input"
                    />
                    {referralValidationState !== "idle" && (
                      <p
                        className={`text-xs ${
                          referralValidationState === "valid"
                            ? "text-[color:var(--color-brand-primary-hover)]"
                            : referralValidationState === "checking"
                              ? "text-content-muted"
                              : "text-[color:var(--color-state-error)]"
                        }`}
                      >
                        {referralValidationState === "checking"
                          ? t("auth.register.referralCodeChecking")
                          : referralValidationMessage}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <GlassButton
                    type="submit"
                    disabled={isLoading || !canSubmit}
                    variant="primary"
                    className="w-full"
                  >
                    {isLoading
                      ? t("auth.register.submitting")
                      : t("auth.register.submit")}
                  </GlassButton>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={isLoading}
                      className="font-medium text-content-muted transition hover:text-content-primary"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSkipStep2()}
                      disabled={isLoading}
                      className="font-medium text-content-muted underline-offset-2 transition hover:text-content-primary hover:underline"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="mt-8 text-center text-sm text-content-muted">
              <span>{t("auth.register.hasAccount")} </span>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-semibold text-[color:var(--color-brand-primary)] transition hover:text-[color:var(--color-brand-primary)]/80"
              >
                {t("auth.register.loginHere")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Register;
