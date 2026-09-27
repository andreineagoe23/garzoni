import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FOUNDER_AUTHOR, isFounderByline } from "@garzoni/core";

export function formatEditorialDate(
  iso: string | null | undefined,
  language: string | undefined
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(
    language?.toLowerCase().startsWith("ro") ? "ro-RO" : "en-GB",
    { year: "numeric", month: "long", day: "numeric" }
  );
}

type Props = {
  /** Stored byline. House names ("Garzoni Team", blank) resolve to the founder. */
  author?: string | null;
  published?: string | null;
  reviewed?: string | null;
  /** Page language when it differs from the app language (e.g. /ro pages). */
  lang?: string;
};

/** "Written by Andrei Neagoe · Published … · Reviewed …" for lessons and guides. */
export default function Byline({ author, published, reviewed, lang }: Props) {
  const { t: appT, i18n } = useTranslation();
  const t = lang ? i18n.getFixedT(lang) : appT;
  const language = lang ?? i18n.language;
  const publishedLabel = formatEditorialDate(published, language);
  const reviewedLabel = formatEditorialDate(reviewed, language);
  const showReviewed = reviewedLabel && reviewedLabel !== publishedLabel;

  return (
    <p className="text-sm text-content-muted">
      {t("editorial.byline.writtenBy")}{" "}
      {isFounderByline(author) ? (
        <Link
          to={FOUNDER_AUTHOR.path}
          rel="author"
          className="font-semibold text-content-primary hover:underline"
        >
          {FOUNDER_AUTHOR.name}
        </Link>
      ) : (
        <span className="font-semibold text-content-primary">{author}</span>
      )}
      {publishedLabel ? (
        <>
          {" · "}
          <time dateTime={published ?? undefined}>
            {t("editorial.byline.published", { date: publishedLabel })}
          </time>
        </>
      ) : null}
      {showReviewed ? (
        <>
          {" · "}
          <time dateTime={reviewed ?? undefined}>
            {t("editorial.byline.reviewed", { date: reviewedLabel })}
          </time>
        </>
      ) : null}
    </p>
  );
}
