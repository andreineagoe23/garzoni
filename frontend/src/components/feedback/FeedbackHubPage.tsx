import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import apiClient from "services/httpClient";
import { useTranslation } from "react-i18next";

type FeedbackType = "bug" | "suggestion" | "other";

function FeedbackHubPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const email = user?.email ?? "";

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [where, setWhere] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname) {
      setWhere((prev) => prev || window.location.pathname);
    }
  }, []);

  const topicByType: Record<FeedbackType, string> = {
    bug: "Bug report",
    suggestion: "Feedback",
    other: "Feedback",
  };

  const feedbackTypeLabel: Record<FeedbackType, string> = {
    bug: "Bug report",
    suggestion: "Suggestion / improvement",
    other: "Something else",
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitMessage("");
    setErrorMessage("");
    setSubmitting(true);

    try {
      const response = await apiClient.post("/contact/", {
        email,
        topic: topicByType[feedbackType],
        message: message.trim(),
        feedback_type: feedbackTypeLabel[feedbackType],
        ...(where.trim() && { context_url: where.trim() }),
      });

      setSubmitMessage(response.data.message || t("feedback.success"));
      setMessage("");
      setWhere(window.location.pathname || "");
    } catch (err) {
      console.error("Feedback form error:", err);
      const e = err as { response?: { data?: { error?: string } } };
      setErrorMessage(e?.response?.data?.error || t("feedback.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      maxWidth="4xl"
      layout="none"
      innerClassName="flex flex-col gap-8"
    >
      <header className="space-y-3 text-center lg:text-left">
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          {t("feedback.title")}
        </h1>
        <p className="text-sm text-content-muted">{t("feedback.subtitle")}</p>
      </header>

      <GlassCard padding="lg">
        {submitMessage && (
          <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-[color:var(--accent,#ffd700)] shadow-inner shadow-[color:var(--accent,#ffd700)]/20">
            {submitMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
              {t("feedback.typeLabel")}
            </label>
            <select
              required
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
              className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-surface-page px-3 py-2 text-sm text-content-primary focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            >
              <option value="bug">{t("feedback.typeBug")}</option>
              <option value="suggestion">{t("feedback.typeSuggestion")}</option>
              <option value="other">{t("feedback.typeOther")}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
              {t("feedback.messageLabel")}
            </label>
            <textarea
              rows={5}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("feedback.messagePlaceholder")}
              className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-surface-page px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
              {t("feedback.whereLabel")}
            </label>
            <input
              type="text"
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder={t("feedback.wherePlaceholder")}
              className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-surface-page px-3 py-2 text-sm text-content-primary placeholder:text-content-muted focus:border-[color:var(--accent,#ffd700)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/support"
              className="text-sm font-medium text-content-muted hover:text-[color:var(--accent,#ffd700)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 rounded"
            >
              {t("feedback.backToSupport")}
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--accent,#ffd700)]/30 transition hover:shadow-xl hover:shadow-[color:var(--accent,#ffd700)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#ffd700)]/40 disabled:opacity-60 disabled:pointer-events-none"
            >
              {submitting ? "…" : t("feedback.send")}
            </button>
          </div>
        </form>
      </GlassCard>
    </PageContainer>
  );
}

export default FeedbackHubPage;
