import { Link } from "react-router-dom";
import { localizedPath, usePublicLocale } from "components/seo/publicLocale";

/**
 * Link to the other-language version of a public page, for the breadcrumb row.
 * Renders nothing unless that version exists, so it never points at a 404.
 */
export default function LanguageSwitch({
  path,
  available,
}: {
  /** Unprefixed path of the page, e.g. "/learn/emergency-fund". */
  path: string;
  available: boolean;
}) {
  const { lang, t } = usePublicLocale();
  if (!available) return null;
  const target = lang === "ro" ? "en" : "ro";
  return (
    <>
      {" · "}
      <Link
        to={localizedPath(path, target)}
        lang={target}
        hrefLang={target}
        rel="alternate"
      >
        {t(
          target === "ro"
            ? "publicLanguage.switchToRo"
            : "publicLanguage.switchToEn"
        )}
      </Link>
    </>
  );
}
