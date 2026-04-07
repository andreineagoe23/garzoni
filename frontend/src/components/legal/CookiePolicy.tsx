import React from "react";
import { Link } from "react-router-dom";
import LegalPageLayout from "components/legal/LegalPageLayout";
import { Trans, useTranslation } from "react-i18next";
import { OPEN_SETTINGS_EVENT } from "contexts/CookieConsentContext";

const openCookieSettings = () =>
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));

const CookiePolicy = () => {
  const { t } = useTranslation();

  return (
    <LegalPageLayout
      lastUpdated={t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
      title={t("legal.cookiePolicy.title")}
      intro={t("legal.cookiePolicy.intro")}
    >
      <h2>{t("legal.cookiePolicy.sections.what.title")}</h2>
      <p>{t("legal.cookiePolicy.sections.what.body")}</p>

      <h2>{t("legal.cookiePolicy.sections.sessionPersistent.title")}</h2>
      <h3>{t("legal.cookiePolicy.sections.sessionPersistent.sessionTitle")}</h3>
      <p>{t("legal.cookiePolicy.sections.sessionPersistent.sessionBody")}</p>
      <h3>
        {t("legal.cookiePolicy.sections.sessionPersistent.persistentTitle")}
      </h3>
      <p>{t("legal.cookiePolicy.sections.sessionPersistent.persistentBody")}</p>

      <h2>{t("legal.cookiePolicy.sections.categories.title")}</h2>
      <ul>
        <li>
          <strong>
            {t("legal.cookiePolicy.sections.categories.items.necessary.label")}
          </strong>{" "}
          {t("legal.cookiePolicy.sections.categories.items.necessary.text")}
        </li>
        <li>
          <strong>
            {t("legal.cookiePolicy.sections.categories.items.preference.label")}
          </strong>{" "}
          {t("legal.cookiePolicy.sections.categories.items.preference.text")}
        </li>
        <li>
          <strong>
            {t("legal.cookiePolicy.sections.categories.items.analytics.label")}
          </strong>{" "}
          {t("legal.cookiePolicy.sections.categories.items.analytics.text")}
        </li>
        <li>
          <strong>
            {t("legal.cookiePolicy.sections.categories.items.marketing.label")}
          </strong>{" "}
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
          className="font-medium text-[color:var(--primary,#1d5330)] underline hover:no-underline"
        >
          {t("cookieConsent.cookieSettings")}
        </button>{" "}
        {t("legal.cookiePolicy.sections.consent.manageHint")}
      </p>

      <h2>{t("legal.cookiePolicy.sections.thirdParty.title")}</h2>
      <p>{t("legal.cookiePolicy.sections.thirdParty.body")}</p>

      <h2>{t("legal.cookiePolicy.sections.declaration.title")}</h2>
      <p>{t("legal.cookiePolicy.sections.declaration.body")}</p>
      <ul>
        <li>{t("legal.cookiePolicy.sections.declaration.necessary")}</li>
        <li>{t("legal.cookiePolicy.sections.declaration.analytics")}</li>
        <li>{t("legal.cookiePolicy.sections.declaration.marketing")}</li>
      </ul>

      <h2>{t("legal.cookiePolicy.sections.contact.title")}</h2>
      <p>
        {t("legal.cookiePolicy.sections.contact.body")}{" "}
        <a href="mailto:hello@garzoni.app">hello@garzoni.app</a>
      </p>
      <p>
        <Trans
          i18nKey="legal.cookiePolicy.sections.contact.related"
          components={{
            privacy: <Link to="/privacy-policy" />,
            terms: <Link to="/terms-of-service" />,
          }}
        />
      </p>
    </LegalPageLayout>
  );
};

export default CookiePolicy;
