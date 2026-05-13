import { Helmet } from "react-helmet-async";

type CourseSchema = {
  name: string;
  description: string;
  image?: string;
};

type Props = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  locale?: "en" | "ro";
  alternates?: Array<{ hrefLang: string; href: string }>;
  course?: CourseSchema;
};

const DEFAULT_IMAGE = "https://www.garzoni.app/og-image.jpg";
const SITE_NAME = "Garzoni";

export default function SeoHead({
  title,
  description,
  canonical,
  image,
  locale = "en",
  alternates,
  course,
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
          sameAs: "https://www.garzoni.app",
        },
        inLanguage: locale,
        ...(course.image ? { image: course.image } : {}),
      }
    : null;

  return (
    <Helmet>
      <html lang={locale} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="article" />
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
    </Helmet>
  );
}
