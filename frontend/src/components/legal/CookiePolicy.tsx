import React from "react";
import { Link } from "react-router-dom";
import { GlassCard } from "components/ui";
import { Trans, useTranslation } from "react-i18next";
import { OPEN_SETTINGS_EVENT } from "contexts/CookieConsentContext";

const mutedClass =
  "text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]";
const contentClass =
  "prose prose-slate max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--accent,#111827)] prose-a:text-[color:var(--primary,#2563eb)] hover:prose-a:text-[color:var(--accent,#2563eb)]";

const openCookieSettings = () =>
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));

const CookiePolicy = () => {
  const { t } = useTranslation();

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

          <h2>{t("legal.cookiePolicy.sections.sessionPersistent.title")}</h2>
          <h3 className="text-lg font-medium mt-4">{t("legal.cookiePolicy.sections.sessionPersistent.sessionTitle")}</h3>
          <p>{t("legal.cookiePolicy.sections.sessionPersistent.sessionBody")}</p>
          <h3 className="text-lg font-medium mt-4">{t("legal.cookiePolicy.sections.sessionPersistent.persistentTitle")}</h3>
          <p>{t("legal.cookiePolicy.sections.sessionPersistent.persistentBody")}</p>

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

          <h2>{t("legal.cookiePolicy.sections.consentRequirement.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.consentRequirement.body")}</p>

          <h2>{t("legal.cookiePolicy.sections.consent.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.consent.body")}</p>
          <p>
            <button
              type="button"
              onClick={openCookieSettings}
              className="font-medium text-[color:var(--primary,#2563eb)] underline hover:no-underline"
            >
              {t("cookieConsent.cookieSettings")}
            </button>{" "}
            {t("legal.cookiePolicy.sections.consent.manageHint")}
          </p>

          <h2>{t("legal.cookiePolicy.sections.thirdParty.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.thirdParty.body")}</p>

          <h2>{t("legal.cookiePolicy.sections.declaration.title")}</h2>
          <p>{t("legal.cookiePolicy.sections.declaration.body")}</p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>{t("legal.cookiePolicy.sections.declaration.necessary")}</li>
            <li>{t("legal.cookiePolicy.sections.declaration.analytics")}</li>
            <li>{t("legal.cookiePolicy.sections.declaration.marketing")}</li>
          </ul>
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
