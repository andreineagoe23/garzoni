/**
 * Popup overlay shown while reCAPTCHA v3 runs (invisible verification).
 * No visible widget on the form; user sees this modal briefly instead.
 */
import React from "react";
import { useTranslation } from "react-i18next";

type Props = {
  open: boolean;
};

export default function RecaptchaVerifyingModal({ open }: Props) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("auth.recaptcha.verifying")}
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--card-bg)] px-8 py-8 shadow-xl">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--border-color)] border-t-[color:var(--primary)]"
          aria-hidden="true"
        />
        <p className="text-center text-sm font-medium text-[color:var(--text-color)]">
          {t("auth.recaptcha.verifying")}
        </p>
        <p className="text-center text-xs text-[color:var(--muted-text)]">
          {t("auth.recaptcha.protectedBy")}
        </p>
      </div>
    </div>
  );
}
