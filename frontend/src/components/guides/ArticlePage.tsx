import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import apiClient from "services/httpClient";
import SeoHead from "components/seo/SeoHead";

type FaqPair = { question: string; answer: string };

type RelatedLesson = {
  slug: string;
  title: string;
  short_description: string;
};

type ArticleResponse = {
  slug: string;
  title: string;
  category: string;
  meta_description: string;
  excerpt: string;
  content: string;
  author: string;
  image_url: string;
  faq: FaqPair[];
  published_at: string | null;
  updated_at: string | null;
  related_lessons: RelatedLesson[];
};

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<ArticleResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<ArticleResponse>(`/public/articles/${slug}/`)
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
  }, [slug]);

  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(data?.content || ""),
    [data?.content]
  );

  if (loading) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error === "not-found" || !data) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <SeoHead
          title="Guide not found — Garzoni"
          description="This guide is not available."
          canonical={`https://www.garzoni.app/guides/${slug ?? ""}`}
        />
        <h1>Guide not found</h1>
        <p>The guide you’re looking for isn’t available.</p>
        <Link to="/guides">Browse all guides →</Link>
      </main>
    );
  }

  const canonical = `https://www.garzoni.app/guides/${data.slug}`;
  const description =
    data.meta_description ||
    data.excerpt ||
    `${data.title} — a free personal finance guide from Garzoni.`;
  const datePublished =
    data.published_at || data.updated_at || new Date().toISOString();

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <SeoHead
        title={`${data.title} — Garzoni`}
        description={description}
        canonical={canonical}
        image={data.image_url || undefined}
        article={{
          headline: data.title,
          datePublished,
          dateModified: data.updated_at || undefined,
          author: data.author || "Garzoni Team",
        }}
        faqItems={data.faq && data.faq.length > 0 ? data.faq : undefined}
        breadcrumbs={[
          { name: "Home", url: "https://www.garzoni.app/" },
          { name: "Guides", url: "https://www.garzoni.app/guides" },
          { name: data.title, url: canonical },
        ]}
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
        <Link to="/">Home</Link> › <Link to="/guides">Guides</Link> ›{" "}
        <span>{data.title}</span>
      </nav>

      <h1>{data.title}</h1>
      <p style={{ fontSize: 14, opacity: 0.65 }}>
        By {data.author || "Garzoni Team"}
      </p>

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
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        style={{ lineHeight: 1.7 }}
      />

      {data.faq && data.faq.length > 0 ? (
        <section style={{ marginTop: "2.5rem" }}>
          <h2>Frequently asked questions</h2>
          {data.faq.map((item, i) => (
            <div key={i} style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ marginBottom: 4 }}>{item.question}</h3>
              <p style={{ marginTop: 0, opacity: 0.85, lineHeight: 1.6 }}>
                {item.answer}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {data.related_lessons.length > 0 ? (
        <section style={{ marginTop: "3rem" }}>
          <h2>Related lessons</h2>
          <ul style={{ lineHeight: 1.9 }}>
            {data.related_lessons.map((l) => (
              <li key={l.slug}>
                <Link to={`/learn/${l.slug}`}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <aside
        style={{
          marginTop: "3rem",
          padding: "1.5rem",
          border: "1px solid #2a3a4a",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Put this into practice</h2>
        <p>
          Garzoni turns guides like this into short interactive lessons with
          quizzes, streaks, and an AI coach. Sign up free to start learning.
        </p>
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
          Create a free account
        </Link>
      </aside>

      <p style={{ marginTop: "2rem" }}>
        <Link to="/guides">← All guides</Link>
      </p>
    </main>
  );
}
