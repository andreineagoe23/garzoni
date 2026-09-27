import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import apiClient from "services/httpClient";
import SeoHead from "components/seo/SeoHead";
import LanguageSwitch from "components/seo/LanguageSwitch";
import {
  SITE_URL,
  hreflangAlternates,
  publicApiParams,
  usePublicLocale,
} from "components/seo/publicLocale";

type ArticleItem = {
  slug: string;
  available_languages?: string[];
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

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  roundup: "publicGuides.categoryRoundup",
  comparison: "publicGuides.categoryComparison",
  alternatives: "publicGuides.categoryAlternatives",
  guide: "publicGuides.categoryGuide",
  answer: "publicGuides.categoryAnswer",
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
  const { lang, t, to, url } = usePublicLocale();
  const [data, setData] = useState<ArticleListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<ArticleListResponse>("/public/articles/", {
        params: publicApiParams(lang),
      })
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
  }, [lang]);

  const results = data?.results ?? [];
  // Same rule as LearnIndex: the pair exists once any guide is in Romanian.
  const bothLanguages =
    lang === "ro"
      ? results.length > 0
      : results.some((a) => a.available_languages?.includes("ro"));

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
        title={t("publicGuides.seoTitle")}
        description={t("publicGuides.seoDescription")}
        canonical={url("/guides")}
        locale={lang}
        alternates={hreflangAlternates(
          "/guides",
          bothLanguages ? ["en", "ro"] : [lang]
        )}
        breadcrumbs={[
          { name: t("learnIndex.breadcrumbHome"), url: `${SITE_URL}/` },
          { name: t("publicGuides.breadcrumbGuides"), url: url("/guides") },
        ]}
        faqItems={lang === "en" ? FAQ_ITEMS : undefined}
      />
      {lang === "ro" && !loading && results.length === 0 ? (
        <Helmet>
          <meta name="robots" content="noindex" />
        </Helmet>
      ) : null}

      <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
        <Link to="/">{t("learnIndex.breadcrumbHome")}</Link> ›{" "}
        <span>{t("publicGuides.breadcrumbGuides")}</span>
        <LanguageSwitch path="/guides" available={bothLanguages} />
      </nav>

      <h1>{t("publicGuides.title")}</h1>
      <p style={{ fontSize: 18, lineHeight: 1.7, maxWidth: 720 }}>
        {t("publicGuides.intro")}
      </p>

      {loading ? (
        <p>{t("publicGuides.loading")}</p>
      ) : grouped.length === 0 ? (
        <p>
          {t("publicGuides.empty")}{" "}
          <Link to={to("/learn")}>{t("publicGuides.emptyCta")}</Link>
        </p>
      ) : (
        grouped.map(([category, articles]) => (
          <section key={category} style={{ marginTop: "2.5rem" }}>
            <h2>
              {t(CATEGORY_LABEL_KEYS[category] ?? "publicGuides.categoryGuide")}
            </h2>
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
                    <Link to={to(`/guides/${article.slug}`)}>
                      {article.title}
                    </Link>
                  </h3>
                  {article.excerpt ? (
                    <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
                      {article.excerpt}
                    </p>
                  ) : null}
                  <Link to={to(`/guides/${article.slug}`)}>
                    {t("publicGuides.readGuide")}
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
        <h2 style={{ marginTop: 0 }}>{t("publicGuides.indexCtaTitle")}</h2>
        <p>{t("publicGuides.indexCtaBody")}</p>
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
          {t("publicGuides.createAccount")}
        </Link>
      </aside>
    </main>
  );
}
