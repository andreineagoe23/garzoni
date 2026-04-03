import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import { useLocation, useNavigate } from "react-router-dom";
import registerBg from "assets/register-bg.jpg?format=webp&quality=75";
import Header from "components/layout/Header";
import { useAuth } from "contexts/AuthContext";
import { useRecaptcha } from "contexts/RecaptchaContext";
import { GlassCard, GlassButton } from "components/ui";
import apiClient from "services/httpClient";
import { getBackendUrl } from "services/backendUrl";
import RecaptchaVerifyingModal from "components/auth/RecaptchaVerifyingModal";

type ReferralValidationState = "idle" | "checking" | "valid" | "invalid";

function Register() {
  const { t } = useTranslation();
  const location = useLocation();
  const initialReferral = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("ref") || "";
  }, [location.search]);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    first_name: "",
    last_name: "",
    referral_code: initialReferral,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyingModal, setShowVerifyingModal] = useState(false);
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

  const validateReferralCode = async (rawCode: string): Promise<boolean> => {
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
      setReferralValidationMessage(t("auth.register.referralCodeCheckFailed"));
      return false;
    }
  };

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
  }, [formData.referral_code]);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setErrorCode(undefined);
    const referralCode = formData.referral_code.trim();
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
      const result = await runRegister({
        ...formData,
        recaptcha_token: token,
      });
      if (result.success) return;
    } catch (registerError) {
      if (axios.isAxiosError(registerError)) {
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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <>
      <RecaptchaVerifyingModal open={showVerifyingModal} />
      <Header />
      <div
        className="relative flex min-h-screen flex-col overflow-hidden bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${registerBg})` }}
      >
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

        <div className="relative flex flex-1 items-center justify-center px-6 pb-12 pt-[110px] sm:px-8 lg:px-10">
          <GlassCard padding="lg" className="w-full max-w-md">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                {t("auth.register.title")}
              </h2>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {t("auth.register.subtitle")}
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mt-6 space-y-2 rounded-lg border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]"
              >
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
              </div>
            )}

            <form onSubmit={handleRegister} className="mt-8 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="first_name"
                    className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                  >
                    {t("auth.register.firstName")}
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                    placeholder={t("auth.register.firstNamePlaceholder")}
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="last_name"
                    className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                  >
                    {t("auth.register.lastName")}
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    autoComplete="family-name"
                    placeholder={t("auth.register.lastNamePlaceholder")}
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                >
                  {t("auth.register.username")}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  placeholder={t("auth.register.usernamePlaceholder")}
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
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
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
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
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 pr-12 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[color:var(--muted-text,#6b7280)] transition hover:text-[color:var(--primary,#1d5330)]"
                    aria-label={
                      showPassword
                        ? t("auth.login.hidePassword")
                        : t("auth.login.showPassword")
                    }
                  >
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="referral_code"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
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
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                />
                {referralValidationState !== "idle" && (
                  <p
                    className={`text-xs ${
                      referralValidationState === "valid"
                        ? "text-emerald-700"
                        : referralValidationState === "checking"
                          ? "text-[color:var(--muted-text,#6b7280)]"
                          : "text-[color:var(--error,#dc2626)]"
                    }`}
                  >
                    {referralValidationState === "checking"
                      ? t("auth.register.referralCodeChecking")
                      : referralValidationMessage}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <GlassButton
                  type="submit"
                  disabled={isLoading}
                  variant="primary"
                  className="w-full"
                >
                  {isLoading
                    ? t("auth.register.submitting")
                    : t("auth.register.submit")}
                </GlassButton>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[color:var(--border-color)]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[color:var(--card-bg)] px-2 text-[color:var(--muted-text)]">
                      {t("auth.orContinueWith")}
                    </span>
                  </div>
                </div>
                <a
                  href={`${getBackendUrl()}/auth/google/?state=onboarding`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border-color)] bg-[color:var(--card-bg)] px-4 py-3 text-sm font-medium text-[color:var(--text-color)] shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
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
              </div>
            </form>

            <div className="mt-8 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
              <span>{t("auth.register.hasAccount")} </span>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-semibold text-[color:var(--primary,#1d5330)] transition hover:text-[color:var(--primary,#1d5330)]/80"
              >
                {t("auth.register.loginHere")}
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

export default Register;
