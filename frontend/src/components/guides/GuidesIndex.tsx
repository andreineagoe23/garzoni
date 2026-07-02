import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "services/httpClient";
import SeoHead from "components/seo/SeoHead";

type ArticleItem = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  image_url: string;
  published_at: string | null;
  updated_at: string | null;
};

type ArticleListResponse = {
  count: number;
  results: ArticleItem[];
};

const CATEGORY_LABELS: Record<string, string> = {
  roundup: "Best-of roundups",
  comparison: "Comparisons",
  alternatives: "Alternatives",
  guide: "Guides",
  answer: "Answers",
};

const CATEGORY_ORDER = [
  "roundup",
  "comparison",
  "alternatives",
  "guide",
  "answer",
];

const FAQ_ITEMS = [
  {
    question: "What are Garzoni guides?",
    answer:
      "In-depth, free articles on personal finance — practical how-to guides, honest app comparisons, and plain-English answers to common money questions. No account required.",
  },
  {
    question: "Are the guides free to read?",
    answer:
      "Yes. Every guide and comparison is free, with no paywall and no sign-up. Create a free account if you want the full interactive lessons, quizzes, and AI coach.",
  },
];

export default function GuidesIndex() {
  const [data, setData] = useState<ArticleListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ArticleListResponse>("/public/articles/")
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
    const map = new Map<string, ArticleItem[]>();
    for (const article of data?.results ?? []) {
      const key = article.category || "guide";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(article);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c)!] as const
    );
  }, [data]);

  return (
    <main style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
      <SeoHead
        title="Personal Finance Guides & Comparisons — Garzoni"
        description="Free personal finance guides, app comparisons, and plain-English answers on budgeting, saving, investing, credit, and debt — from Garzoni."
        canonical="https://www.garzoni.app/guides"
        breadcrumbs={[
          { name: "Home", url: "https://www.garzoni.app/" },
          { name: "Guides", url: "https://www.garzoni.app/guides" },
        ]}
        faqItems={FAQ_ITEMS}
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
        <Link to="/">Home</Link> › <span>Guides</span>
      </nav>

      <h1>Personal Finance Guides & Comparisons</h1>
      <p style={{ fontSize: 18, lineHeight: 1.7, maxWidth: 720 }}>
        Deep dives, honest app comparisons, and straight answers to the money
        questions people actually ask. Free to read, no jargon, no sales pitch.
      </p>

      {loading ? (
        <p>Loading guides…</p>
      ) : grouped.length === 0 ? (
        <p>
          New guides are coming soon.{" "}
          <Link to="/learn">Browse our free lessons</Link> in the meantime.
        </p>
      ) : (
        grouped.map(([category, articles]) => (
          <section key={category} style={{ marginTop: "2.5rem" }}>
            <h2>{CATEGORY_LABELS[category] ?? "Guides"}</h2>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {articles.map((article) => (
                <li
                  key={article.slug}
                  style={{
                    border: "1px solid #2a3a4a",
                    borderRadius: 12,
                    padding: "1.25rem",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    <Link to={`/guides/${article.slug}`}>{article.title}</Link>
                  </h3>
                  {article.excerpt ? (
                    <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
                      {article.excerpt}
                    </p>
                  ) : null}
                  <Link to={`/guides/${article.slug}`}>Read guide →</Link>
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
        <h2 style={{ marginTop: 0 }}>Learn money, step by step</h2>
        <p>
          Garzoni turns these guides into interactive lessons with quizzes,
          streaks, and an AI coach. Sign up free to start the full path.
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
    </main>
  );
}
