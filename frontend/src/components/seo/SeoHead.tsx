import { Helmet } from "react-helmet-async";

type CourseSchema = {
  name: string;
  description: string;
  image?: string;
  /** Parent course title, emitted as isPartOf on the LearningResource. */
  partOf?: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type Breadcrumb = {
  name: string;
  url: string;
};

type ArticleSchema = {
  headline: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
};

type Props = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  locale?: "en" | "ro";
  alternates?: Array<{ hrefLang: string; href: string }>;
  course?: CourseSchema;
  faqItems?: FaqItem[];
  breadcrumbs?: Breadcrumb[];
  article?: ArticleSchema;
};

const DEFAULT_IMAGE = "https://www.garzoni.app/og-image.jpg";
const SITE_NAME = "Garzoni";
const SITE_URL = "https://www.garzoni.app";
// @id of the Organization node defined in the index.html entity graph. Detail
// pages reference it instead of re-declaring a partial Organization, so the
// whole site resolves to a single publisher entity.
const ORG_ID = `${SITE_URL}/#organization`;

export default function SeoHead({
  title,
  description,
  canonical,
  image,
  locale = "en",
  alternates,
  course,
  faqItems,
  breadcrumbs,
  article,
}: Props) {
  const ogImage = image || DEFAULT_IMAGE;
  // A single lesson is a LearningResource (an individual educational unit), not a
  // full Course. Free + provider-linked + language-tagged for entity/AI clarity.
  const learningResourceJsonLd = course
    ? {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: course.name,
        description: course.description,
        url: canonical,
        learningResourceType: "Lesson",
        educationalUse: "self-study",
        isAccessibleForFree: true,
        inLanguage: locale,
        provider: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        about: { "@type": "Thing", name: "Personal finance" },
        ...(course.partOf
          ? { isPartOf: { "@type": "Course", name: course.partOf } }
          : {}),
        ...(course.image ? { image: course.image } : {}),
      }
    : null;

  const faqJsonLd =
    faqItems && faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  const breadcrumbJsonLd =
    breadcrumbs && breadcrumbs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((crumb, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: crumb.name,
            item: crumb.url,
          })),
        }
      : null;

  const articleJsonLd = article
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.headline,
        url: canonical,
        mainEntityOfPage: canonical,
        isAccessibleForFree: true,
        inLanguage: locale,
        datePublished: article.datePublished,
        ...(article.dateModified ? { dateModified: article.dateModified } : {}),
        author: {
          "@type": "Person",
          name: article.author || "Garzoni Team",
        },
        publisher: { "@id": ORG_ID },
        image: ogImage,
      }
    : null;

  return (
    <Helmet>
      <html lang={locale} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={article ? "article" : "website"} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta
        property="og:locale"
        content={locale === "ro" ? "ro_RO" : "en_GB"}
      />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {alternates?.map((a) => (
        <link
          key={a.hrefLang}
          rel="alternate"
          hrefLang={a.hrefLang}
          href={a.href}
        />
      ))}

      {learningResourceJsonLd ? (
        <script type="application/ld+json">
          {JSON.stringify(learningResourceJsonLd)}
        </script>
      ) : null}

      {faqJsonLd ? (
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      ) : null}

      {breadcrumbJsonLd ? (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      ) : null}

      {articleJsonLd ? (
        <script type="application/ld+json">
          {JSON.stringify(articleJsonLd)}
        </script>
      ) : null}
    </Helmet>
  );
}
