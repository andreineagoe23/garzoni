import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import apiClient from "services/httpClient";
import SeoHead from "components/seo/SeoHead";

type LessonItem = {
  slug: string;
  title: string;
  short_description: string;
  image_url: string;
  course: { id: number; title: string };
  path: { id: number | null; title: string };
  /** Present when the lesson exposes an interactive sample question (UX 3.1). */
  has_sample_question?: boolean;
};

type LessonListResponse = {
  count: number;
  results: LessonItem[];
};

// Crawler-facing only (JSON-LD FAQPage via SeoHead, never rendered). The
// canonical for /learn is the English page and carries no hreflang, so these
// and the SeoHead strings below stay English regardless of the UI language.
const FAQ_ITEMS = [
  {
    question: "Are Garzoni's lessons free?",
    answer:
      "Yes. Every lesson listed here is free to read, no account required. Sign up free to track progress, earn streaks, and unlock quizzes and AI-powered tools.",
  },
  {
    question: "What topics does Garzoni cover?",
    answer:
      "Budgeting, saving, debt management, investing basics, credit scores, and taxes — taught in ten-minute lessons with spaced repetition so knowledge sticks.",
  },
  {
    question: "Who is Garzoni for?",
    answer:
      "Garzoni is built for young adults learning to manage money for the first time — students, early-career professionals, and anyone who wants financial literacy without jargon.",
  },
];

export default function LearnIndex() {
  const { t } = useTranslation();
  const [data, setData] = useState<LessonListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<LessonListResponse>("/public/lessons/")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setData({ count: 0, results: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, LessonItem[]>();
    for (const lesson of data?.results ?? []) {
      const key = lesson.course.title || t("learnIndex.fallbackCourseTitle");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lesson);
    }
    return Array.from(map.entries());
  }, [data, t]);

  return (
    <main style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
      <SeoHead
        title="Free Personal Finance Lessons — Garzoni"
        description="Browse Garzoni's free finance lessons: budgeting, saving, investing, credit scores, debt management, and taxes. Ten-minute lessons that make money simple."
        canonical="https://www.garzoni.app/learn"
        breadcrumbs={[
          { name: "Home", url: "https://www.garzoni.app/" },
          { name: "Lessons", url: "https://www.garzoni.app/learn" },
        ]}
        faqItems={FAQ_ITEMS}
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
        <Link to="/">{t("learnIndex.breadcrumbHome")}</Link> ›{" "}
        <span>{t("learnIndex.breadcrumbLessons")}</span>
      </nav>

      <h1>{t("learnIndex.title")}</h1>
      <p style={{ fontSize: 18, lineHeight: 1.7, maxWidth: 720 }}>
        {t("learnIndex.intro")}
      </p>

      {loading ? (
        <p>{t("learnIndex.loading")}</p>
      ) : grouped.length === 0 ? (
        <p>
          {t("learnIndex.empty")}{" "}
          <Link to="/register">{t("learnIndex.emptyCta")}</Link>
        </p>
      ) : (
        grouped.map(([courseTitle, lessons]) => (
          <section key={courseTitle} style={{ marginTop: "2.5rem" }}>
            <h2>{courseTitle}</h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {lessons.map((lesson) => (
                <li
                  key={lesson.slug}
                  style={{
                    border: "1px solid #2a3a4a",
                    borderRadius: 12,
                    padding: "1.25rem",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    <Link to={`/learn/${lesson.slug}`}>{lesson.title}</Link>
                    {lesson.has_sample_question ? (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: "uppercase",
                          verticalAlign: "middle",
                          borderRadius: 999,
                          background: "rgba(34,197,94,0.15)",
                          color: "#22c55e",
                        }}
                      >
                        {t("learnIndex.sampleQuestionBadge")}
                      </span>
                    ) : null}
                  </h3>
                  {lesson.short_description ? (
                    <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
                      {lesson.short_description}
                    </p>
                  ) : null}
                  <Link to={`/learn/${lesson.slug}`}>
                    {t("learnIndex.readLesson")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <aside
        style={{
          marginTop: "3rem",
          padding: "1.5rem",
          border: "1px solid #2a3a4a",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>{t("learnIndex.deeperTitle")}</h2>
        <p>{t("learnIndex.deeperBody")}</p>
        <Link
          to="/register"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "#22c55e",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {t("learnIndex.deeperCta")}
        </Link>
      </aside>
    </main>
  );
}
