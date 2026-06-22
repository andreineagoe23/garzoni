import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { requestPasswordReset } from "services/authService";
import { useNavigate } from "react-router-dom";
import logo from "assets/logo/logo.svg";
import FormNotice from "components/common/FormNotice";

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await requestPasswordReset(email);
      setMessage(response.data.message || t("auth.forgotPassword.success"));
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setError(
          requestError.response?.data?.error ||
            requestError.response?.data?.detail ||
            t("auth.forgotPassword.error")
        );
      } else {
        setError(t("auth.forgotPassword.error"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reset Password | Garzoni</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="relative flex min-h-screen items-center justify-center bg-[color:var(--color-surface-page)] transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--color-brand-primary)]/20 via-transparent to-transparent" />
        <div className="relative w-full max-w-lg px-6 py-12 sm:px-10">
          <div
            className="app-card flex flex-col items-center px-6 py-10"
            style={{
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <img
              src={logo}
              alt={t("auth.forgotPassword.logoAlt")}
              className="mb-6 h-12 w-auto"
              loading="lazy"
            />
            <h2 className="text-2xl font-bold text-[color:var(--accent,#2563eb)]">
              {t("auth.forgotPassword.title")}
            </h2>
            <p className="mt-2 text-center text-sm text-content-muted">
              {t("auth.forgotPassword.subtitle")}
            </p>

            {message && (
              <FormNotice variant="success" className="mt-6 w-full">
                {message}
              </FormNotice>
            )}

            {error && (
              <FormNotice variant="error" className="mt-6 w-full">
                {error}
              </FormNotice>
            )}

            <form
              onSubmit={handleForgotPassword}
              className="mt-6 w-full space-y-6"
            >
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-content-muted"
                >
                  {t("auth.forgotPassword.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("auth.forgotPassword.emailPlaceholder")}
                  required
                  className="app-input"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center rounded-lg bg-[color:var(--color-brand-primary)] px-5 py-3 text-base font-semibold text-white shadow-lg shadow-[color:var(--color-brand-primary)]/40 transition hover:shadow-xl hover:shadow-[color:var(--color-brand-primary)]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading
                  ? t("auth.forgotPassword.submitting")
                  : t("auth.forgotPassword.submit")}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-8 text-sm font-semibold text-[color:var(--accent,#2563eb)] transition hover:text-[color:var(--accent,#2563eb)]/80"
            >
              {t("auth.forgotPassword.backToLogin")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ForgotPassword;
