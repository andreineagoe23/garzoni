import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import { GlassCard } from "components/ui";

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
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [contactData, setContactData] = useState({
    email: "",
    topic: "",
    message: "",
  });
  const [submitMessage, setSubmitMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFaq, setSelectedFaq] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const headers = {};
        const token = getAccessToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/faq/`,
          { headers }
        );
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
  }, [getAccessToken]);

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
      const headers = {};
      const token = getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/contact/`,
        contactData,
        { headers }
      );

      setSubmitMessage(
        response.data.message ||
          "Your message has been received! Thank you for contacting us."
      );
      setContactData({ email: "", topic: "", message: "" });
    } catch (submitError) {
      console.error("Contact form error:", submitError);
      setErrorMessage("Failed to send message. Please try again later.");
    }
  };

  const toggleFaq = (index) => {
    setSelectedFaq((prev) => (prev === index ? null : index));
  };

  const submitVote = async (faqId, vote) => {
    try {
      const headers = {};
      const token = getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/faq/${faqId}/vote/`,
        { vote },
        { headers }
      );

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
                    : faq.not_helpful_count,
              }
            : faq
        )
      );
    } catch (voteError) {
      console.error("Vote failed", voteError);
    }
  };

  return (
    <PageContainer maxWidth="5xl" layout="none" innerClassName="flex flex-col gap-8">
        <header className="space-y-3 text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            Help Center
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Search for topics, browse categories, or reach out to our support
            team directly.
          </p>
        </header>

        <GlassCard padding="md" className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xl">
            <input
              type="text"
              placeholder="Search FAQs..."
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
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-4 py-2 text-xs focus:ring-[color:var(--accent,#2563eb)]/40 ${
                activeCategory === "all"
                  ? "bg-gradient-to-r from-[color:var(--primary,#2563eb)] to-[color:var(--primary,#2563eb)]/90 text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40"
                  : "border border-white/20 bg-[color:var(--card-bg,#ffffff)]/60 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--accent,#2563eb)]/60 hover:bg-[color:var(--accent,#2563eb)]/10 hover:text-[color:var(--accent,#2563eb)]"
              }`}
              style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus:outline-none focus:ring-2 backdrop-blur-sm touch-manipulation relative z-10 px-4 py-2 text-xs focus:ring-[color:var(--accent,#2563eb)]/40 ${
                  activeCategory === category
                    ? "bg-gradient-to-r from-[color:var(--primary,#2563eb)] to-[color:var(--primary,#2563eb)]/90 text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40"
                    : "border border-white/20 bg-[color:var(--card-bg,#ffffff)]/60 text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--accent,#2563eb)]/60 hover:bg-[color:var(--accent,#2563eb)]/10 hover:text-[color:var(--accent,#2563eb)]"
                }`}
                style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
              >
                {category}
              </button>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard padding="lg">
            {loading ? (
              <div className="py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                Loading FAQs...
              </div>
            ) : filteredFAQs.length === 0 ? (
              <div className="py-6 text-center text-sm text-[color:var(--muted-text,#6b7280)]">
                No FAQs match your search. Try different keywords or clear your
                filters.
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
                            <span>Was this helpful?</span>
                            {faq.user_vote === "helpful" ? (
                              <span className="font-semibold text-emerald-500">
                                Thanks for your feedback! 👍
                              </span>
                            ) : faq.user_vote === "not_helpful" ? (
                              <span className="font-semibold text-[color:var(--error,#dc2626)]">
                                Thanks for your feedback! 👎
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => submitVote(faq.id, "helpful")}
                                  className="inline-flex items-center justify-center rounded-full border border-emerald-500 px-3 py-1 font-semibold text-emerald-500 transition hover:bg-emerald-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                >
                                  👍 Helpful
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    submitVote(faq.id, "not_helpful")
                                  }
                                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--error,#dc2626)] px-3 py-1 font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--error,#dc2626)]/40"
                                >
                                  👎 Not really
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
                Still need help? Contact us
              </h2>
              <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
                Share a brief description of the issue and we’ll be in touch.
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
                Your Email
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
                  className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                />
              </label>

              <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
                Topic
                <select
                  required
                  value={contactData.topic}
                  onChange={(event) =>
                    setContactData((prev) => ({
                      ...prev,
                      topic: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  <option value="">Select a topic</option>
                  <option value="Billing">Billing</option>
                  <option value="Technical Issue">Technical Issue</option>
                  <option value="Account">Account</option>
                  <option value="Content">Course Content</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="block text-sm font-semibold text-[color:var(--accent,#111827)]">
                Message
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
                  className="mt-2 w-full rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:border-[color:var(--accent,#2563eb)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#2563eb)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--primary,#2563eb)]/30 transition hover:shadow-xl hover:shadow-[color:var(--primary,#2563eb)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent,#2563eb)]/40"
                >
                  Send Message
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
    </PageContainer>
  );
}

export default FAQPage;
