import { Helmet } from "react-helmet-async";

type CourseSchema = {
  name: string;
  description: string;
  image?: string;
  /** Parent course title, emitted as isPartOf on the LearningResource. */
  partOf?: string;
  /** ISO date of the most recent content edit → schema dateModified. */
  dateModified?: string;
  /** External references → schema citation. */
  citations?: Array<{ name?: string; url: string }>;
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

// A ranked app/item in a roundup or alternatives page → emitted as ItemList.
type ItemListEntry = {
  name: string;
  url?: string;
  description?: string;
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
  /** Ranked apps in a roundup/alternatives page → ItemList JSON-LD. */
  itemList?: ItemListEntry[];
  /** Human-readable name for the ItemList (defaults to the page title). */
  itemListName?: string;
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
  itemList,
  itemListName,
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
        ...(course.dateModified ? { dateModified: course.dateModified } : {}),
        ...(course.partOf
          ? { isPartOf: { "@type": "Course", name: course.partOf } }
          : {}),
        ...(course.citations && course.citations.length > 0
          ? {
              citation: course.citations.map((c) => ({
                "@type": "CreativeWork",
                ...(c.name ? { name: c.name } : {}),
                url: c.url,
              })),
            }
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

  // Roundup / alternatives pages: a ranked ItemList of apps. Each entry is a
  // SoftwareApplication so the list reads as an app comparison to crawlers.
  const itemListJsonLd =
    itemList && itemList.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: itemListName || title,
          url: canonical,
          numberOfItems: itemList.length,
          itemListOrder: "https://schema.org/ItemListOrderDescending",
          itemListElement: itemList.map((entry, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "SoftwareApplication",
              name: entry.name,
              applicationCategory: "FinanceApplication",
              ...(entry.url ? { url: entry.url } : {}),
              ...(entry.description ? { description: entry.description } : {}),
            },
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

      {itemListJsonLd ? (
        <script type="application/ld+json">
          {JSON.stringify(itemListJsonLd)}
        </script>
      ) : null}
    </Helmet>
  );
}
