import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import PageContainer from "components/common/PageContainer";
import { GlassCard } from "components/ui";
import apiClient from "services/httpClient";
import { useTranslation } from "react-i18next";
import { useAuth } from "contexts/AuthContext";

const highlightText = (text, query) => {
  if (!query?.trim()) return text;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark
        key={`highlight-${index}`}
        className="rounded bg-[color:var(--primary-bright,#2a7347)]/10 px-1 py-0.5 text-[color:var(--primary-bright,#2a7347)]"
      >
        {part}
      </mark>
    ) : (
      <span key={`text-${index}`}>{part}</span>
    )
  );
};

function SupportPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [contactData, setContactData] = useState({
    email: "",
    topic: "",
    message: "",
  });
  const [submitMessage, setSubmitMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(null);
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const response = await apiClient.get("/support/");
        setEntries(response.data);
        setCategories([
          ...new Set(
            response.data.map((entry) => entry.category).filter(Boolean)
          ),
        ]);
      } catch (error) {
        console.error("Error fetching support:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesSearch =
        !normalizedSearch ||
        entry.question.toLowerCase().includes(normalizedSearch) ||
        entry.answer.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        activeCategory === "all" || entry.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [entries, search, activeCategory]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");
    setErrorMessage("");

    try {
      const response = await apiClient.post("/contact/", contactData);

      setSubmitMessage(response.data.message || t("support.contact.success"));
      setContactData({ email: "", topic: "", message: "" });
    } catch (submitError) {
      console.error("Contact form error:", submitError);
      setErrorMessage(t("support.contact.error"));
    }
  };

  const toggleEntry = (index) => {
    setSelectedEntryIndex((prev) => (prev === index ? null : index));
  };

  const submitVote = async (entryId, vote) => {
    try {
      await apiClient.post(`/support/${entryId}/vote/`, { vote });

      setEntries((prevEntries) =>
        prevEntries.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                user_vote: vote,
                helpful_count:
                  vote === "helpful"
                    ? entry.helpful_count + 1
                    : entry.helpful_count,
                not_helpful_count:
                  vote === "not_helpful"
                    ? entry.not_helpful_count + 1
                    : entry.not_helpful_count,
              }
            : entry
        )
      );
    } catch (voteError) {
      console.error("Vote failed", voteError);
    }
  };

  return (
    <PageContainer
      maxWidth="5xl"
      layout="none"
      innerClassName="flex flex-col gap-8"
    >
      <header className="space-y-3 lg:text-left">
        <p className="app-eyebrow text-content-muted">
          {t("support.header.kicker")}
        </p>
        <h1 className="text-[2.75rem] leading-[1.05] tracking-[-0.03em]">
          {t("support.header.title")}
        </h1>
        <p className="text-sm text-content-muted max-w-xl">
          {t("support.header.subtitle")}
        </p>
      </header>

      <GlassCard
        padding="md"
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="relative w-full md:max-w-xl">
          <input
            type="text"
            placeholder={t("support.search.placeholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-full border border-[color:var(--border-color,#d1d5db)] bg-surface-page px-4 py-2 text-sm text-content-primary shadow-sm focus:border-[color:var(--primary-bright,#2a7347)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-bright,#2a7347)]/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-content-muted hover:text-[color:var(--primary-bright,#2a7347)]"
            >
              {t("support.search.clear")}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="support-filter-select"
            className="text-sm font-medium text-content-primary"
          >
            {t("support.filter.label")}
          </label>
          <select
            id="support-filter-select"
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value)}
            className="w-full rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-bright,#2a7347)]/40 md:w-auto"
            aria-label={t("support.filter.aria")}
          >
            <option value="all">{t("support.filter.all")}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </GlassCard>

      <div className="space-y-6">
        <GlassCard padding="lg">
          {loading ? (
            <div className="py-6 text-center text-sm text-content-muted">
              {t("support.loading")}
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-6 text-center text-sm text-content-muted">
              {t("support.empty")}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry, index) => {
                const isActive = selectedEntryIndex === index;
                return (
                  <article
                    key={entry.id}
                    className="overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-surface-page transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => toggleEntry(index)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[color:var(--card-bg,#ffffff)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary-bright,#2a7347)]/40"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="app-badge app-badge-primary shrink-0">
                          {entry.category}
                        </span>
                        <p className="text-sm font-medium text-content-primary">
                          {highlightText(entry.question, search)}
                        </p>
                      </div>
                      <span
                        className="text-content-muted shrink-0 text-xs transition-transform duration-200"
                        style={{
                          transform: isActive ? "rotate(180deg)" : "none",
                        }}
                      >
                        ▾
                      </span>
                    </button>
                    {isActive && (
                      <div className="space-y-4 border-t border-[color:var(--border-soft,rgba(0,0,0,0.06))] bg-[color:var(--card-bg,#ffffff)] px-5 py-4 text-sm text-content-primary leading-relaxed">
                        <div>{highlightText(entry.answer, search)}</div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-content-muted">
                          <span>{t("support.vote.prompt")}</span>
                          {entry.user_vote === "helpful" ? (
                            <span className="font-semibold text-[color:var(--primary-bright,#2a7347)]">
                              {t("support.vote.thanksHelpful")}
                            </span>
                          ) : entry.user_vote === "not_helpful" ? (
                            <span className="font-semibold text-[color:var(--error,#dc2626)]">
                              {t("support.vote.thanksNotHelpful")}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => submitVote(entry.id, "helpful")}
                                className="inline-flex items-center justify-center rounded-full border border-[color:var(--primary-bright,#2a7347)] px-3 py-1 font-semibold text-[color:var(--primary-bright,#2a7347)] transition hover:bg-[color:var(--primary-bright,#2a7347)] hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary-bright,#2a7347)]/40"
                              >
                                {t("support.vote.helpful")}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  submitVote(entry.id, "not_helpful")
                                }
                                className="inline-flex items-center justify-center rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--error,#dc2626)]/40"
                              >
                                {t("support.vote.notHelpful")}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </GlassCard>

        {isAuthenticated && (
          <GlassCard
            padding="lg"
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-content-primary">
                {t("support.feedbackSection.title")}
              </h2>
              <p className="text-sm text-content-muted">
                {t("support.feedbackSection.description")}
              </p>
            </div>
            <Link
              to="/feedback"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary-bright,#2a7347)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary-bright,#2a7347)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-bright,#2a7347)]/40"
            >
              {t("support.feedbackSection.cta")}
            </Link>
          </GlassCard>
        )}

        <GlassCard padding="lg">
          <header className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-content-primary">
              {t("support.contact.title")}
            </h2>
            <p className="text-sm text-content-muted">
              {t("support.contact.subtitle")}
            </p>
          </header>

          {submitMessage && (
            <div className="mt-4 rounded-2xl border border-[color:var(--primary-bright,#2a7347)]/40 bg-[color:var(--primary-bright,#2a7347)]/10 px-4 py-3 text-sm text-[color:var(--primary-bright,#2a7347)] shadow-inner shadow-[color:var(--primary-bright,#2a7347)]/15">
              {submitMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-content-primary">
              {t("support.contact.email")}
              <input
                type="email"
                required
                value={contactData.email}
                onChange={(event) =>
                  setContactData((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                className="app-input mt-2"
              />
            </label>

            <label className="block text-sm font-semibold text-content-primary">
              {t("support.contact.topic")}
              <select
                required
                value={contactData.topic}
                onChange={(event) =>
                  setContactData((prev) => ({
                    ...prev,
                    topic: event.target.value,
                  }))
                }
                className="app-input mt-2"
              >
                <option value="">{t("support.contact.selectTopic")}</option>
                <option value="Billing">
                  {t("support.contact.topics.billing")}
                </option>
                <option value="Technical Issue">
                  {t("support.contact.topics.technical")}
                </option>
                <option value="Account">
                  {t("support.contact.topics.account")}
                </option>
                <option value="Content">
                  {t("support.contact.topics.content")}
                </option>
                <option value="Feedback">
                  {t("support.contact.topics.feedback")}
                </option>
                <option value="Other">
                  {t("support.contact.topics.other")}
                </option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-content-primary">
              {t("support.contact.message")}
              <textarea
                rows={5}
                required
                value={contactData.message}
                onChange={(event) =>
                  setContactData((prev) => ({
                    ...prev,
                    message: event.target.value,
                  }))
                }
                className="app-input mt-2"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary-bright,#2a7347)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary-bright,#2a7347)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-bright,#2a7347)]/40"
              >
                {t("support.contact.send")}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </PageContainer>
  );
}

export default SupportPage;
