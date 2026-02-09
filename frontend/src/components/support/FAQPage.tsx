import React, { useState, useEffect, useMemo } from "react";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";
import apiClient from "services/httpClient";
import { useTranslation } from "react-i18next";

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
        className="rounded bg-[color:var(--accent,#2563eb)]/10 px-1 py-0.5 text-[color:var(--accent,#2563eb)]"
      >
        {part}
      </mark>
    ) : (
      <span key={`text-${index}`}>{part}</span>
    )
  );
};

function FAQPage() {
  const { getAccessToken } = useAuth();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [contactData, setContactData] = useState({
    email: "",
    topic: "",
    message: "" });
  const [submitMessage, setSubmitMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFaq, setSelectedFaq] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await apiClient.get("/faq/");
        setFaqs(response.data);
        setCategories([
          ...new Set(response.data.map((faq) => faq.category).filter(Boolean)),
        ]);
      } catch (error) {
        console.error("Error fetching FAQs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFaqs();
  }, []);

  const filteredFAQs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return faqs.filter((faq) => {
      const matchesSearch =
        !normalizedSearch ||
        faq.question.toLowerCase().includes(normalizedSearch) ||
        faq.answer.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        activeCategory === "all" || faq.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [faqs, search, activeCategory]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");
    setErrorMessage("");

    try {
      const response = await apiClient.post("/contact/", contactData);

      setSubmitMessage(
        response.data.message ||
          t("faq.contact.success")
      );
      setContactData({ email: "", topic: "", message: "" });
    } catch (submitError) {
      console.error("Contact form error:", submitError);
      setErrorMessage(
        t("faq.contact.error")
      );
    }
  };

  const toggleFaq = (index) => {
    setSelectedFaq((prev) => (prev === index ? null : index));
  };

  const submitVote = async (faqId, vote) => {
    try {
      await apiClient.post(`/faq/${faqId}/vote/`, { vote });

      setFaqs((prevFaqs) =>
        prevFaqs.map((faq) =>
          faq.id === faqId
            ? {
                ...faq,
                user_vote: vote,
                helpful_count:
                  vote === "helpful"
                    ? faq.helpful_count + 1
                    : faq.helpful_count,
                not_helpful_count:
                  vote === "not_helpful"
                    ? faq.not_helpful_count + 1
                    : faq.not_helpful_count }
            : faq
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
      <header className="space-y-3 text-center lg:text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          {t("faq.header.kicker")}
        </p>
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          {t("faq.header.title")}
        </h1>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("faq.header.subtitle")}
        </p>
      </header>

      <GlassCard
        padding="md"
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="relative w-full md:max-w-xl">
          <input
            type="text"
            placeholder={t("faq.search.placeholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-full border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-2 text-sm text-[color:var(--text-color,#111827)] shadow-sm focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:text-[color:var(--accent,#2563eb)]"
            >
              {t("faq.search.clear")}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="faq-filter-select"
            className="text-sm font-medium text-[color:var(--text-color,#111827)]"
          >
            {t("faq.filter.label")}
          </label>
          <select
            id="faq-filter-select"
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value)}
            className="w-full rounded-lg border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40 md:w-auto"
            aria-label={t("faq.filter.aria")}
          >
            <option value="all">
              {t("faq.filter.all")}
            </option>
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
            <div className="py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("faq.loading")}
            </div>
          ) : filteredFAQs.length === 0 ? (
            <div className="py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("faq.empty")}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFAQs.map((faq, index) => {
                const isActive = selectedFaq === index;
                return (
                  <article
                    key={faq.id}
                    className="overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[color:var(--card-bg,#ffffff)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#2563eb)]/40"
                    >
                      <div className="space-y-2">
                        <span className="inline-flex items-center rounded-full bg-[color:var(--accent,#2563eb)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--accent,#2563eb)]">
                          {faq.category}
                        </span>
                        <p className="text-sm font-semibold text-[color:var(--accent,#111827)]">
                          {highlightText(faq.question, search)}
                        </p>
                      </div>
                      <span className="text-xs text-[color:var(--muted-text,#6b7280)]">
                        {isActive ? "▲" : "▼"}
                      </span>
                    </button>
                    {isActive && (
                      <div className="space-y-4 border-t border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-5 py-4 text-sm text-[color:var(--text-color,#111827)]">
                        <div>{highlightText(faq.answer, search)}</div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-text,#6b7280)]">
                          <span>
                            {t("faq.vote.prompt")}
                          </span>
                          {faq.user_vote === "helpful" ? (
                            <span className="font-semibold text-emerald-500">
                              {t("faq.vote.thanksHelpful")}
                            </span>
                          ) : faq.user_vote === "not_helpful" ? (
                            <span className="font-semibold text-[color:var(--error,#dc2626)]">
                              {t("faq.vote.thanksNotHelpful")}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => submitVote(faq.id, "helpful")}
                                className="inline-flex items-center justify-center rounded-full border border-emerald-500 px-3 py-1 font-semibold text-emerald-500 transition hover:bg-emerald-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                              >
                                {t("faq.vote.helpful")}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  submitVote(faq.id, "not_helpful")
                                }
                                className="inline-flex items-center justify-center rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--error,#dc2626)]/40"
                              >
                                {t("faq.vote.notHelpful")}
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

        <GlassCard padding="lg">
          <header className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-[color:var(--accent,#111827)]">
              {t("faq.contact.title")}
            </h2>
            <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
              {t("faq.contact.subtitle")}
            </p>
          </header>

          {submitMessage && (
            <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500 shadow-inner shadow-emerald-500/20">
              {submitMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-4 py-3 text-sm text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/20">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
              {t("faq.contact.email")}
              <input
                type="email"
                required
                value={contactData.email}
                onChange={(event) =>
                  setContactData((prev) => ({
                    ...prev,
                    email: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
            </label>

            <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
              {t("faq.contact.topic")}
              <select
                required
                value={contactData.topic}
                onChange={(event) =>
                  setContactData((prev) => ({
                    ...prev,
                    topic: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              >
                <option value="">
                  {t("faq.contact.selectTopic")}
                </option>
                <option value="Billing">
                  {t("faq.contact.topics.billing")}
                </option>
                <option value="Technical Issue">
                  {t("faq.contact.topics.technical")}
                </option>
                <option value="Account">
                  {t("faq.contact.topics.account")}
                </option>
                <option value="Content">
                  {t("faq.contact.topics.content")}
                </option>
                <option value="Feedback">
                  {t("faq.contact.topics.feedback")}
                </option>
                <option value="Other">
                  {t("faq.contact.topics.other")}
                </option>
              </select>
            </label>

            <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
              {t("faq.contact.message")}
              <textarea
                rows={5}
                required
                value={contactData.message}
                onChange={(event) =>
                  setContactData((prev) => ({
                    ...prev,
                    message: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
              >
                {t("faq.contact.send")}
              </button>
            </div>
          </form>
        </GlassCard>
      </div>
    </PageContainer>
  );
}

export default FAQPage;
