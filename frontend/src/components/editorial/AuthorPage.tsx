import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  EDITORIAL_STANDARDS_PATH,
  FOUNDER_AUTHOR,
  ORGANIZATION_ID,
  isFounderByline,
} from "@garzoni/core";
import apiClient from "services/httpClient";
import SeoHead from "components/seo/SeoHead";
import Breadcrumbs from "components/common/Breadcrumbs";
import PageContainer from "components/common/PageContainer";
import { GlassCard } from "components/ui";

type ContentLink = { slug: string; title: string };
type GuideCard = ContentLink & { author?: string };

const TOPIC_KEYS = [
  "budgeting",
  "saving",
  "debt",
  "credit",
  "investing",
  "tax",
] as const;

function ContentList({
  heading,
  items,
  basePath,
}: {
  heading: string;
  items: ContentLink[] | null;
  basePath: string;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-content-primary">{heading}</h2>
      {items === null ? (
        <p className="text-content-muted">{t("editorial.author.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-content-muted">{t("editorial.author.empty")}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.slug}>
              <Link
                to={`${basePath}/${item.slug}`}
                className="text-brand-primary hover:underline"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AuthorPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [guides, setGuides] = useState<ContentLink[] | null>(null);
  const [lessons, setLessons] = useState<ContentLink[] | null>(null);
  const isKnownAuthor = slug === FOUNDER_AUTHOR.slug;

  useEffect(() => {
    if (!isKnownAuthor) return;
    let cancelled = false;
    apiClient
      .get<{ results: GuideCard[] }>("/public/articles/")
      .then((res) => {
        if (cancelled) return;
        setGuides(
          (res.data.results ?? []).filter((g) => isFounderByline(g.author))
        );
      })
      .catch(() => {
        if (!cancelled) setGuides([]);
      });
    // Every lesson is written and edited by the founder.
    apiClient
      .get<{ results: ContentLink[] }>("/public/lessons/")
      .then((res) => {
        if (!cancelled) setLessons(res.data.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isKnownAuthor]);

  if (!isKnownAuthor) return <Navigate to="/about" replace />;

  const sameAs = FOUNDER_AUTHOR.sameAs.filter(Boolean);
  const topics = TOPIC_KEYS.map((key) => t(`editorial.author.topics.${key}`));
  const university = {
    "@type": "CollegeOrUniversity",
    name: FOUNDER_AUTHOR.alumniOf,
  };
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: FOUNDER_AUTHOR.url,
    name: t("editorial.author.seoTitle"),
    mainEntity: {
      "@type": "Person",
      "@id": FOUNDER_AUTHOR.id,
      name: FOUNDER_AUTHOR.name,
      url: FOUNDER_AUTHOR.url,
      jobTitle: t("editorial.author.role"),
      description: t("editorial.author.bio"),
      worksFor: { "@id": ORGANIZATION_ID },
      alumniOf: university,
      hasCredential: {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "degree",
        name: FOUNDER_AUTHOR.degree,
        recognizedBy: university,
      },
      knowsAbout: ["Personal finance", ...topics],
      ...(FOUNDER_AUTHOR.image ? { image: FOUNDER_AUTHOR.image } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
  };

  return (
    <PageContainer maxWidth="4xl">
      <SeoHead
        title={t("editorial.author.seoTitle")}
        description={t("editorial.author.seoDescription")}
        canonical={FOUNDER_AUTHOR.url}
        image={FOUNDER_AUTHOR.image || undefined}
        breadcrumbs={[
          {
            name: t("editorial.breadcrumbs.home"),
            url: "https://www.garzoni.app/",
          },
          {
            name: t("editorial.breadcrumbs.about"),
            url: "https://www.garzoni.app/about",
          },
          { name: FOUNDER_AUTHOR.name, url: FOUNDER_AUTHOR.url },
        ]}
        jsonLd={[profileJsonLd]}
      />

      <Breadcrumbs
        items={[
          { label: t("editorial.breadcrumbs.home"), to: "/" },
          { label: t("editorial.breadcrumbs.about"), to: "/about" },
          { label: FOUNDER_AUTHOR.name },
        ]}
      />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {FOUNDER_AUTHOR.image ? (
          <img
            src={FOUNDER_AUTHOR.image}
            alt={t("editorial.author.photoAlt")}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-content-primary">
            {FOUNDER_AUTHOR.name}
          </h1>
          <p className="text-content-muted">{t("editorial.author.jobTitle")}</p>
        </div>
      </header>

      <GlassCard padding="lg" hover={false}>
        <div className="flex flex-col gap-4 leading-relaxed text-content-primary">
          <p>{t("editorial.author.bio")}</p>
          <p>{t("editorial.author.education")}</p>
          <p className="text-content-muted">
            {t("editorial.author.disclaimer")}
          </p>
        </div>
      </GlassCard>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-content-primary">
          {t("editorial.author.topicsHeading")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <li
              key={topic}
              className="rounded-full border border-border px-3 py-1 text-sm text-content-muted"
            >
              {topic}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-content-primary">
          {t("editorial.author.processHeading")}
        </h2>
        <p className="leading-relaxed text-content-primary">
          {t("editorial.author.processBody")}
        </p>
        <Link
          to={EDITORIAL_STANDARDS_PATH}
          className="text-brand-primary hover:underline"
        >
          {t("editorial.links.standards")} →
        </Link>
      </section>

      {sameAs.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-content-primary">
            {t("editorial.author.profilesHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            {sameAs.map((href) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="me noopener noreferrer"
                  className="text-brand-primary hover:underline"
                >
                  {href.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ContentList
        heading={t("editorial.author.guidesHeading")}
        items={guides}
        basePath="/guides"
      />
      <ContentList
        heading={t("editorial.author.lessonsHeading")}
        items={lessons}
        basePath="/learn"
      />
    </PageContainer>
  );
}
