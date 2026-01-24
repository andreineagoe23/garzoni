import React, { useState } from "react";
import axios from "axios";
import { confirmPasswordReset } from "services/authService";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

function ResetPassword() {
  const { uidb64, token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

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
      setError(
        t("resetPassword.mismatch", { defaultValue: "Passwords do not match." })
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await confirmPasswordReset(uidb64, token, {
        new_password: password,
        confirm_password: confirmPassword,
      });

      setMessage(
        response.data.message ||
          t("resetPassword.success", {
            defaultValue: "Password reset successful.",
          })
      );
      setTimeout(() => navigate("/login"), 2500);
    } catch (resetError) {
      if (axios.isAxiosError(resetError)) {
        setError(
          resetError.response?.data?.message ||
            resetError.response?.data?.error ||
            t("resetPassword.error")
        );
      } else {
        setError(t("resetPassword.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[color:var(--bg-color,#0f172a)] px-6 py-12 sm:px-8 transition-colors">
      <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/25 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.25),_transparent_55%)] pointer-events-none" />

      <div
        className="relative w-full max-w-lg rounded-2xl border border-[color:var(--border-color,#1f2937)] bg-[color:var(--card-bg,#111827)] px-6 py-10 shadow-2xl shadow-black/40 backdrop-blur transition-colors"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-bold text-[color:var(--accent,#ffffff)]">
            {t("resetPassword.title")}
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#cbd5f5)]">
            {t("resetPassword.subtitle")}
          </p>
        </div>

        {message && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-lg border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-lg border border-[color:var(--error,#ef4444)]/40 bg-[color:var(--error,#ef4444)]/10 px-4 py-3 text-sm text-[color:var(--error,#ef4444)]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-[color:var(--muted-text,#cbd5f5)]"
            >
              {t("resetPassword.passwordLabel")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-[color:var(--border-color,#334155)] bg-[color:var(--input-bg,#0f172a)] px-4 py-3 text-[color:var(--text-color,#f8fafc)] shadow-inner shadow-black/20 transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              placeholder={t("resetPassword.passwordPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-[color:var(--muted-text,#cbd5f5)]"
            >
              {t("resetPassword.confirmLabel")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-[color:var(--border-color,#334155)] bg-[color:var(--input-bg,#0f172a)] px-4 py-3 text-[color:var(--text-color,#f8fafc)] shadow-inner shadow-black/20 transition focus:border-[color:var(--accent,#2563eb)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              placeholder={t("resetPassword.confirmPlaceholder")}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[color:var(--primary,#2563eb)] px-5 py-3 text-base font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/40 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary,#2563eb)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? t("resetPassword.saving")
              : t("resetPassword.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
