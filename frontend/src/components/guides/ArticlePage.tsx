import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import apiClient from "services/httpClient";
import SeoHead from "components/seo/SeoHead";
import Byline from "components/editorial/Byline";
import LanguageSwitch from "components/seo/LanguageSwitch";
import {
  SITE_URL,
  hreflangAlternates,
  publicApiParams,
  usePublicLocale,
} from "components/seo/publicLocale";

type FaqPair = { question: string; answer: string };

type ItemListEntry = { name: string; url?: string; description?: string };

type RelatedLesson = {
  slug: string;
  title: string;
  short_description: string;
};

type ArticleResponse = {
  slug: string;
  available_languages?: string[];
  title: string;
  category: string;
  meta_description: string;
  excerpt: string;
  content: string;
  author: string;
  image_url: string;
  faq: FaqPair[];
  item_list: ItemListEntry[];
  published_at: string | null;
  updated_at: string | null;
  related_lessons: RelatedLesson[];
};

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, t, to, url, shareImage } = usePublicLocale();
  const [data, setData] = useState<ArticleResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    apiClient
      .get<ArticleResponse>(`/public/articles/${slug}/`, {
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

  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(data?.content || ""),
    [data?.content]
  );

  if (loading) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <p>{t("publicGuides.loadingGuide")}</p>
      </main>
    );
  }

  if (error === "not-found" || !data) {
    return (
      <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <SeoHead
          title={t("publicGuides.notFoundSeoTitle")}
          description={t("publicGuides.notFoundSeoDescription")}
          canonical={url(`/guides/${slug ?? ""}`)}
          locale={lang}
        />
        <h1>{t("publicGuides.notFoundTitle")}</h1>
        <p>{t("publicGuides.notFoundBody")}</p>
        <Link to={to("/guides")}>{t("publicGuides.browseAll")}</Link>
      </main>
    );
  }

  const path = `/guides/${data.slug}`;
  const canonical = url(path);
  const description =
    data.meta_description ||
    data.excerpt ||
    t("publicGuides.fallbackDescription", { title: data.title });
  const datePublished =
    data.published_at || data.updated_at || new Date().toISOString();

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <SeoHead
        title={`${data.title} — Garzoni`}
        description={description}
        canonical={canonical}
        locale={lang}
        alternates={hreflangAlternates(path, data.available_languages)}
        image={data.image_url || shareImage(path)}
        imageAlt={
          data.image_url
            ? undefined
            : `${t("shareImage.kicker.guide")}: ${data.title}`
        }
        article={{
          headline: data.title,
          datePublished,
          dateModified: data.updated_at || undefined,
          author: data.author,
        }}
        faqItems={data.faq && data.faq.length > 0 ? data.faq : undefined}
        itemList={
          data.item_list && data.item_list.length > 0
            ? data.item_list
            : undefined
        }
        itemListName={data.title}
        breadcrumbs={[
          { name: t("learnIndex.breadcrumbHome"), url: `${SITE_URL}/` },
          { name: t("publicGuides.breadcrumbGuides"), url: url("/guides") },
          { name: data.title, url: canonical },
        ]}
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: 14, opacity: 0.7 }}>
        <Link to="/">{t("learnIndex.breadcrumbHome")}</Link> ›{" "}
        <Link to={to("/guides")}>{t("publicGuides.breadcrumbGuides")}</Link> ›{" "}
        <span>{data.title}</span>
        <LanguageSwitch
          path={path}
          available={(data.available_languages ?? []).length > 1}
        />
      </nav>

      <h1>{data.title}</h1>
      <Byline
        author={data.author}
        published={data.published_at}
        reviewed={data.updated_at}
        lang={lang}
      />

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
          <h2>{t("publicGuides.faqTitle")}</h2>
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
          <h2>{t("publicGuides.relatedLessons")}</h2>
          <ul style={{ lineHeight: 1.9 }}>
            {data.related_lessons.map((l) => (
              <li key={l.slug}>
                <Link to={to(`/learn/${l.slug}`)}>{l.title}</Link>
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
        <h2 style={{ marginTop: 0 }}>{t("publicGuides.practiceTitle")}</h2>
        <p>{t("publicGuides.practiceBody")}</p>
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

      <p style={{ marginTop: "2rem" }}>
        <Link to={to("/guides")}>{t("publicGuides.allGuides")}</Link>
      </p>
    </main>
  );
}
