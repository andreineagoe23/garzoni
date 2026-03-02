import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import loginBg from "assets/login-bg.jpg";
import Header from "components/layout/Header";
import { useAuth } from "contexts/AuthContext";
import { useRecaptcha } from "contexts/RecaptchaContext";
import { GlassCard, GlassButton } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";
import RecaptchaVerifyingModal from "components/auth/RecaptchaVerifyingModal";

function Login() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    remember_me: false,
  });
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerifyingModal, setShowVerifyingModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser, isAuthenticated, isInitialized } = useAuth();
  const { executeRecaptcha } = useRecaptcha();

  useEffect(() => {
    // Error from AuthCallback (e.g. after Google OAuth redirect)
    const stateError = (location.state as { oauthError?: string } | undefined)
      ?.oauthError;
    if (stateError) {
      setError(stateError);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    const params = new URLSearchParams(location.search);
    const reason = params.get("reason");
    const oauthError = params.get("error");
    if (oauthError) {
      const messages: Record<string, string> = {
        oauth_denied: "Google sign-in was cancelled.",
        oauth_not_configured: "Google sign-in is not configured.",
        oauth_missing_code: "Google sign-in failed: missing response.",
        oauth_token_failed: "Google sign-in failed. Please try again.",
        oauth_userinfo_failed:
          "Could not get your Google profile. Please try again.",
        oauth_no_email: "Your Google account has no email we can use.",
      };
      setError(
        messages[oauthError] || "Google sign-in failed. Please try again."
      );
      params.delete("error");
      const remaining = params.toString();
      navigate(remaining ? `/login?${remaining}` : "/login", { replace: true });
      return;
    }
    if (reason !== "session-expired") return;

    setError(t("auth.login.sessionExpired"));

    // Remove the query param so it doesn't persist across refreshes.
    params.delete("reason");
    const remaining = params.toString();
    const nextUrl = remaining ? `/login?${remaining}` : "/login";
    navigate(nextUrl, { replace: true, state: location.state });
  }, [location.search, location.state, navigate, t]);

  useEffect(() => {
    if (isAuthenticated) {
      // Avoid redirect loops into gated flows that immediately bounce to questionnaires/upgrade
      const from = location.state?.from?.pathname;
      const gatedPaths = [
        "/personalized-path",
        "/subscriptions",
        "/payment-required",
      ];
      const destination = gatedPaths.includes(from) ? "/all-topics" : from;

      // Default to the main dashboard when there's no safe destination
      const targetPath = destination || "/all-topics";
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isInitialized) return;

    setIsLoading(true);
    setError("");
    setErrorCode(undefined);

    const runLogin = async (payload: Record<string, unknown>) => {
      const result = await loginUser(payload);
      if (!result.success) {
        setError(result.error || t("auth.login.loginFailed"));
        setErrorCode(result.code);
      }
      return result;
    };

    try {
      if (executeRecaptcha) {
        setShowVerifyingModal(true);
        try {
          const token = await executeRecaptcha("login");
          const result = await runLogin({
            ...formData,
            recaptcha_token: token,
          });
          if (result.success) return;
        } finally {
          setShowVerifyingModal(false);
        }
      } else {
        await runLogin(formData);
      }
    } catch (loginError) {
      if (axios.isAxiosError(loginError)) {
        const data = loginError.response?.data;
        const msg =
          (typeof data?.detail === "string" ? data.detail : null) ||
          (typeof data?.error === "string" ? data.error : null) ||
          (loginError.response
            ? t("auth.login.unexpectedError")
            : t("auth.login.networkError"));
        setError(msg);
        setErrorCode(data?.code);
      } else {
        setError(t("auth.login.unexpectedError"));
        setErrorCode(undefined);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <RecaptchaVerifyingModal open={showVerifyingModal} />
      <Header />
      <div
        className="relative flex min-h-screen flex-col overflow-hidden bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url(${loginBg})` }}
      >
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

        <div className="relative flex flex-1 items-center justify-center px-6 pb-12 pt-[110px] sm:px-8 lg:px-10">
          <GlassCard padding="lg" className="w-full max-w-md">
            <div className="space-y-3 text-center">
              <h2 className="text-3xl font-bold text-[color:var(--text-color,#111827)]">
                {t("auth.login.title")}
              </h2>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                {t("auth.login.subtitle")}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-6 space-y-1 rounded-lg border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)]"
              >
                <p>{error}</p>
                {errorCode && (
                  <p className="text-xs opacity-80">Error code: {errorCode}</p>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                >
                  {t("auth.login.username")}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/30"
                  placeholder={t("auth.login.usernamePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-[color:var(--muted-text,#374151)]"
                >
                  {t("auth.login.password")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-[color:var(--border-color,#e5e7eb)] bg-[color:var(--input-bg,#ffffff)] px-4 py-3 pr-12 text-[color:var(--text-color,#111827)] shadow-sm transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/30"
                    placeholder={t("auth.login.passwordPlaceholder")}
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

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm text-[color:var(--muted-text,#4b5563)]">
                  <input
                    type="checkbox"
                    name="remember_me"
                    checked={formData.remember_me}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-[color:var(--border-color,#d1d5db)] text-[color:var(--primary,#1d5330)] focus:ring-[color:var(--primary,#1d5330)]"
                  />
                  {t("auth.login.rememberMe")}
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm font-semibold text-[color:var(--primary,#1d5330)] transition hover:text-[color:var(--primary,#1d5330)]/80"
                >
                  {t("auth.login.forgotPassword")}
                </button>
              </div>

              <div className="space-y-3">
                <GlassButton
                  type="submit"
                  disabled={isLoading}
                  variant="primary"
                  className="w-full"
                >
                  {isLoading
                    ? t("auth.login.submitting")
                    : t("auth.login.submit")}
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
                  href={`${BACKEND_URL}/auth/google/?state=all-topics`}
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
              <span>{t("auth.login.noAccount")} </span>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="font-semibold text-[color:var(--primary,#1d5330)] transition hover:text-[color:var(--primary,#1d5330)]/80"
              >
                {t("auth.login.signUpNow")}
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

export default Login;
