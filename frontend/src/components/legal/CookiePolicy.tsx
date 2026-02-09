import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";
import { Trans, useTranslation } from "react-i18next";

const COOKIEBOT_ID = "12b9cf17-1f30-4bd3-8327-7a29ec5d4ee1";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const CookiePolicy = () => {
  const { t } = useTranslation();
  const declarationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = declarationRef.current;
    if (!container) return;

    container.innerHTML = "";

    const existingScript = document.getElementById("CookieDeclaration");
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement("script");
    script.id = "CookieDeclaration";
    script.src = `https://consent.cookiebot.com/${COOKIEBOT_ID}/cd.js`;
    script.async = true;
    script.dataset.cbid = COOKIEBOT_ID;

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      document
        .querySelectorAll("[data-cookieconsent], .CookiebotAlert")
        .forEach((element) => element.remove());
    };
  }, []);

  return (
    <section className="bg-[color:var(--bg-color,#f8fafc)] px-4 py-10">
      <GlassCard padding="xl" className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-3">
          <p className={mutedClass}>
            {t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            {t("legal.cookiePolicy.title")}
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("legal.cookiePolicy.intro")}
          </p>
        </header>

        <div className={contentClass}>
          <h2>{t("legal.cookiePolicy.sections.what.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.what.body")}</p>

          <h2>{t("legal.cookiePolicy.sections.categories.title")}</h2>
          <ul>
            <li>
              <strong>{t("legal.cookiePolicy.sections.categories.items.necessary.label")}</strong>{" "}
              {t("legal.cookiePolicy.sections.categories.items.necessary.text")}
            </li>
            <li>
              <strong>{t("legal.cookiePolicy.sections.categories.items.preference.label")}</strong>{" "}
              {t("legal.cookiePolicy.sections.categories.items.preference.text")}
            </li>
            <li>
              <strong>{t("legal.cookiePolicy.sections.categories.items.analytics.label")}</strong>{" "}
              {t("legal.cookiePolicy.sections.categories.items.analytics.text")}
            </li>
            <li>
              <strong>{t("legal.cookiePolicy.sections.categories.items.marketing.label")}</strong>{" "}
              {t("legal.cookiePolicy.sections.categories.items.marketing.text")}
            </li>
          </ul>

          <h2>{t("legal.cookiePolicy.sections.consent.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.consent.body")}</p>

          <h2>{t("legal.cookiePolicy.sections.thirdParty.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.thirdParty.body")}</p>

          <h2>{t("legal.cookiePolicy.sections.declaration.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.declaration.body")}</p>
        </div>

        <div
          ref={declarationRef}
          id="cookie-declaration"
          className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--bg-color,#f8fafc)] px-4 py-6 text-sm text-[color:var(--text-color,#111827)] shadow-inner shadow-black/5"
        >
          <p className="text-center text-xs text-[color:var(--muted-text,#6b7280)]">
            {t("legal.cookiePolicy.declaration.loading")}
          </p>
        </div>

        <div className={contentClass}>
          <h2>{t("legal.cookiePolicy.sections.contact.title")}</h2>
          <p>
            {t("legal.cookiePolicy.sections.contact.body")}{" "}
            <a href="mailto:monevo.educational@gmail.com">
              monevo.educational@gmail.com
            </a>
          </p>
          <p>
            <Trans
              i18nKey="legal.cookiePolicy.sections.contact.related"
              components={{
                privacy: <Link to="/privacy-policy" />,
                terms: <Link to="/terms-of-service" /> }}
            />
          </p>
        </div>
      </GlassCard>
    </section>
  );
};

export default CookiePolicy;
