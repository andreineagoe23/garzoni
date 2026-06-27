import { Helmet } from "react-helmet-async";

type CourseSchema = {
  name: string;
  description: string;
  image?: string;
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
  const courseJsonLd = course
    ? {
        "@context": "https://schema.org",
        "@type": "Course",
        name: course.name,
        description: course.description,
        provider: {
          "@type": "Organization",
          name: SITE_NAME,
          sameAs: SITE_URL,
        },
        inLanguage: locale,
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
        datePublished: article.datePublished,
        ...(article.dateModified ? { dateModified: article.dateModified } : {}),
        author: {
          "@type": "Person",
          name: article.author || "Garzoni Team",
        },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/logo-512.png`,
          },
        },
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

      {courseJsonLd ? (
        <script type="application/ld+json">
          {JSON.stringify(courseJsonLd)}
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
