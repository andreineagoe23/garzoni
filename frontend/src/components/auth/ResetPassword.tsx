import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "@garzoni/core";
import { confirmPasswordReset } from "services/authService";
import { useParams, useNavigate } from "react-router-dom";
import FormNotice from "components/common/FormNotice";

function ResetPassword() {
  const { t } = useTranslation();
  const { uidb64, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError(t("auth.resetPassword.passwordsDoNotMatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await confirmPasswordReset(uidb64, token, {
        new_password: password,
        confirm_password: confirmPassword,
      });

      setMessage(
        `${response.data.message || t("auth.resetPassword.success")} ${t(
          "auth.resetPassword.redirectingToLogin"
        )}`
      );
      setTimeout(() => navigate("/login"), 2500);
    } catch (resetError) {
      if (isAxiosError(resetError)) {
        setError(
          resetError.response?.data?.message ||
            resetError.response?.data?.error ||
            t("auth.resetPassword.error")
        );
      } else {
        setError(t("auth.resetPassword.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-page flex items-center justify-center px-6 py-12 sm:px-8">
      <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--color-brand-primary)]/30 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(29,83,48,0.35),_transparent_55%)] pointer-events-none" />

      <div
        className="app-card app-card--pad-lg relative w-full max-w-lg"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div className="mb-8 space-y-2 text-center">
          <h1 className="app-display text-3xl text-content-primary">
            {t("auth.resetPassword.title")}
          </h1>
          <p className="text-sm text-content-muted">
            {t("auth.resetPassword.subtitle")}
          </p>
        </div>

        {message && (
          <FormNotice variant="success" className="mb-6">
            {message}
          </FormNotice>
        )}

        {error && (
          <FormNotice variant="error" className="mb-6">
            {error}
          </FormNotice>
        )}

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-content-muted"
            >
              {t("auth.resetPassword.newPassword")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="app-input"
              placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-content-muted"
            >
              {t("auth.resetPassword.confirmPassword")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="app-input"
              placeholder={t("auth.resetPassword.confirmPlaceholder")}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[color:var(--color-brand-primary)] px-5 py-3 text-base font-semibold text-white shadow-lg shadow-[color:var(--color-brand-primary)]/40 transition hover:shadow-xl hover:shadow-[color:var(--color-brand-primary)]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? t("auth.resetPassword.submitting")
              : t("auth.resetPassword.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
