import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import apiClient from "services/httpClient";
import { recordFunnelEvent } from "services/analyticsService";
import { appStoreUrl, playStoreUrl } from "utils/storeLinks";
import SeoHead from "components/seo/SeoHead";
import Byline from "components/editorial/Byline";
import LanguageSwitch from "components/seo/LanguageSwitch";
import {
  SITE_URL,
  hreflangAlternates,
  publicApiParams,
  usePublicLocale,
} from "components/seo/publicLocale";

/**
 * Optional interactive "sample question" attached to a public lesson (UX plan
 * 3.1 — reciprocity before signup). The backend whitelists one question per
 * public lesson; the field may be absent, in which case no card renders.
 */
type SampleQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type PublicLessonResponse = {
  slug: string;
  available_languages?: string[];
  title: string;
  short_description: string;
  detailed_content: string;
  image_url: string;
  updated_at: string | null;
  course: { id: number; title: string };
  sample_question?: SampleQuestion | null;
  sections: Array<{
    id: number;
    order: number;
    title: string;
    content_type: string;
    text_content: string;
    source_label: string;
    source_url: string;
  }>;
};

/** Sign up, then land back in this lesson's course once onboarding is done. */
function registerHref(courseId: number): string {
  return `/register?next=${encodeURIComponent(`/lessons/${courseId}/flow`)}`;
}

/** True only when the payload is a usable, well-formed sample question. */
function isValidSampleQuestion(q: unknown): q is SampleQuestion {
  if (!q || typeof q !== "object") return false;
  const c = q as Partial<SampleQuestion>;
  return (
    typeof c.question === "string" &&
    c.question.trim().length > 0 &&
    Array.isArray(c.options) &&
    c.options.length >= 2 &&
    c.options.every((o) => typeof o === "string") &&
    typeof c.correct_index === "number" &&
    c.correct_index >= 0 &&
    c.correct_index < c.options.length
  );
}

/**
 * Interactive "Try it" quiz card. One attempt: options lock after the first
 * answer, then feedback + explanation + a reciprocity nudge to sign up.
 */
function SampleQuestionCard({
  question,
  lessonSlug,
  signupHref,
}: {
  question: SampleQuestion;
  lessonSlug: string;
  signupHref: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = answered && selected === question.correct_index;

  const handleAnswer = (index: number) => {
    if (answered) return;
    setSelected(index);
    Promise.resolve(
      recordFunnelEvent("sample_question_answered", {
        metadata: {
          correct: index === question.correct_index,
          lesson_slug: lessonSlug,
        },
      })
    ).catch(() => {});
  };

  const optionStyle = (index: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "block",
      width: "100%",
      textAlign: "left",
      padding: "0.75rem 1rem",
      marginTop: "0.5rem",
      borderRadius: 10,
      border: "1px solid #2a3a4a",
      background: "transparent",
      color: "inherit",
      font: "inherit",
      cursor: answered ? "default" : "pointer",
      transition: "border-color 0.15s, background 0.15s",
    };
    if (!answered) return base;
    if (index === question.correct_index) {
      return {
        ...base,
        borderColor: "#22c55e",
        background: "rgba(34,197,94,0.12)",
      };
    }
    if (index === selected) {
      return {
        ...base,
        borderColor: "#ef4444",
        background: "rgba(239,68,68,0.1)",
      };
    }
    return { ...base, opacity: 0.6 };
  };

  return (
    <section
      style={{
        marginTop: "2.5rem",
        padding: "1.5rem",
        border: "1px solid #2a3a4a",
        borderRadius: 12,
      }}
      aria-label="Try it — sample question"
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "#22c55e",
        }}
      >
        Try it
      </p>
      <h2 style={{ marginTop: "0.5rem" }}>{question.question}</h2>
      <div role="group" aria-label="Answer options">
        {question.options.map((option, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleAnswer(index)}
            disabled={answered}
            aria-pressed={selected === index}
            style={optionStyle(index)}
          >
            {option}
          </button>
        ))}
      </div>
      {answered ? (
        <div style={{ marginTop: "1.25rem" }}>
          <p
            style={{
              fontWeight: 700,
              color: isCorrect ? "#22c55e" : "#ef4444",
            }}
          >
            {isCorrect ? "Correct!" : "Not quite."}
          </p>
          {question.explanation ? (
            <p style={{ lineHeight: 1.6 }}>{question.explanation}</p>
          ) : null}
          <p style={{ marginTop: "1rem", fontWeight: 600 }}>
            You’d have earned 10 XP — create a free account to keep it.
          </p>
          <Link
            to={signupHref}
            style={{
              display: "inline-block",
              marginTop: "0.5rem",
              padding: "0.75rem 1.5rem",
              background: "#22c55e",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Create a free account
          </Link>
        </div>
      ) : null}
    </section>
  );
}

type RelatedLesson = {
  slug: string;
  title: string;
  short_description: string;
  course: { id: number; title: string };
};

export default function PublicLesson() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, t, to, url: absUrl } = usePublicLocale();
  const [data, setData] = useState<PublicLessonResponse | null>(null);
  const [related, setRelated] = useState<RelatedLesson[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    apiClient
      .get<PublicLessonResponse>(`/public/lessons/${slug}/`, {
        params: publicApiParams(lang),
      })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err?.response?.status === 404 ? "not-found" : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, lang]);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    apiClient
      .get<{ results: RelatedLesson[] }>("/public/lessons/", {
        params: publicApiParams(lang),
      })
      .then((res) => {
        if (cancelled) return;
        const others = (res.data.results ?? [])
          .filter((l) => l.slug !== data.slug && l.course.id === data.course.id)
          .slice(0, 4);
        setRelated(others);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [data, lang]);

  const sanitizedLessonHtml = useMemo(
    () => DOMPurify.sanitize(data?.detailed_content || ""),
    [data?.detailed_content]
  );
  const sanitizedSections = useMemo(
    () =>
      (data?.sections ?? []).map((section) => ({
        ...section,
        sanitizedText: DOMPurify.sanitize(section.text_content || ""),
      })),
    [data?.sections]
  );
  // Unique external references across sections → visible Sources block + schema.
  const sources = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ name: string; url: string }> = [];
    for (const s of data?.sections ?? []) {
      const url = (s.source_url || "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ name: (s.source_label || "").trim() || url, url });
    }
    return out;
  }, [data?.sections]);

  if (loading) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <p>{t("publicLesson.loading")}</p>
      </main>
    );
  }

  if (error === "not-found" || !data) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <SeoHead
          title={t("publicLesson.notFoundSeoTitle")}
          description={t("publicLesson.notFoundSeoDescription")}
          canonical={absUrl(`/learn/${slug ?? ""}`)}
          locale={lang}
        />
        <h1>{t("publicLesson.notFoundTitle")}</h1>
        <p>{t("publicLesson.notFoundBody")}</p>
        <Link to="/register">{t("publicLesson.createAccount")}</Link>
      </main>
    );
  }

  const path = `/learn/${data.slug}`;
  const canonical = absUrl(path);
  const description =
    data.short_description ||
    t("publicLesson.fallbackDescription", { title: data.title });

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <SeoHead
        title={`${data.title} — Garzoni`}
        description={description}
        canonical={canonical}
        locale={lang}
        alternates={hreflangAlternates(path, data.available_languages)}
        image={data.image_url || undefined}
        course={{
          name: data.title,
          description,
          image: data.image_url || undefined,
          partOf: data.course?.title || undefined,
          dateModified: data.updated_at || undefined,
          citations: sources.length > 0 ? sources : undefined,
        }}
        breadcrumbs={[
          { name: t("learnIndex.breadcrumbHome"), url: `${SITE_URL}/` },
          { name: t("learnIndex.breadcrumbLessons"), url: absUrl("/learn") },
          { name: data.title, url: canonical },
        ]}
      />
      <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
        <Link to="/">{t("learnIndex.breadcrumbHome")}</Link> ›{" "}
        <Link to={to("/learn")}>{t("learnIndex.breadcrumbLessons")}</Link> ›{" "}
        <span>{data.course.title}</span>
        <LanguageSwitch
          path={path}
          available={(data.available_languages ?? []).length > 1}
        />
      </nav>
      <h1>{data.title}</h1>
      <Byline reviewed={data.updated_at} lang={lang} />
      {data.short_description ? <p>{data.short_description}</p> : null}
      {data.image_url ? (
        <img
          src={data.image_url}
          alt={data.title}
          width={1200}
          height={630}
          style={{ width: "100%", height: "auto", borderRadius: 12 }}
          loading="lazy"
        />
      ) : null}
      <article
        dangerouslySetInnerHTML={{ __html: sanitizedLessonHtml }}
        style={{ lineHeight: 1.7 }}
      />
      {sanitizedSections.map((s) => (
        <section key={s.id}>
          <h2>{s.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: s.sanitizedText }} />
        </section>
      ))}
      {isValidSampleQuestion(data.sample_question) ? (
        <SampleQuestionCard
          question={data.sample_question}
          lessonSlug={data.slug}
          signupHref={registerHref(data.course.id)}
        />
      ) : null}
      {sources.length > 0 ? (
        <section style={{ marginTop: "2.5rem" }}>
          <h2>{t("publicLesson.sources")}</h2>
          <ul style={{ lineHeight: 1.8, fontSize: 14 }}>
            {sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {related.length > 0 ? (
        <section style={{ marginTop: "3rem" }}>
          <h2>{t("publicLesson.relatedLessons")}</h2>
          <ul style={{ lineHeight: 1.9 }}>
            {related.map((l) => (
              <li key={l.slug}>
                <Link to={to(`/learn/${l.slug}`)}>{l.title}</Link>
              </li>
            ))}
          </ul>
          <p>
            <Link to={to("/learn")}>{t("publicLesson.browseAll")}</Link>
          </p>
        </section>
      ) : (
        <p style={{ marginTop: "2rem" }}>
          <Link to={to("/learn")}>{t("publicLesson.browseAll")}</Link>
        </p>
      )}
      <aside
        style={{
          marginTop: "3rem",
          padding: "1.5rem",
          border: "1px solid #2a3a4a",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>{t("publicLesson.keepLearningTitle")}</h2>
        <p>{t("publicLesson.keepLearningBody")}</p>
        <Link
          to={registerHref(data.course.id)}
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
          {t("publicLesson.createAccount")}
        </Link>
        <p style={{ marginTop: "1rem", marginBottom: 0 }}>
          <a
            href={appStoreUrl("lesson_footer")}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, opacity: 0.85 }}
          >
            {t("publicLesson.appStore")}
          </a>
        </p>
        <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
          <a
            href={playStoreUrl("lesson_footer")}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, opacity: 0.85 }}
          >
            {t("publicLesson.googlePlay")}
          </a>
        </p>
      </aside>
    </main>
  );
}
