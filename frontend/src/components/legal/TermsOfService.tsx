import React from "react";
import { Link } from "react-router-dom";
import LegalPageLayout from "components/legal/LegalPageLayout";
import { Trans, useTranslation } from "react-i18next";

const TermsOfService = () => {
  const { t } = useTranslation();
  return (
    <LegalPageLayout
      lastUpdated={t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
      title={t("legal.terms.title")}
    >
      <h2>{t("legal.terms.sections.agreement.title")}</h2>
      <p>
        <Trans
          i18nKey="legal.terms.sections.agreement.body"
          components={{
            privacy: <Link to="/privacy-policy" />,
            cookie: <Link to="/cookie-policy" />,
          }}
        />
      </p>

      <h2>{t("legal.terms.sections.about.title")}</h2>
      <p>{t("legal.terms.sections.about.body1")}</p>
      <p>
        <Trans
          i18nKey="legal.terms.sections.about.body2"
          components={{
            financial: <Link to="/financial-disclaimer" />,
          }}
        />
      </p>

      <h2>{t("legal.terms.sections.security.title")}</h2>
      <p>{t("legal.terms.sections.security.body")}</p>

      <h2>{t("legal.terms.sections.acceptableUse.title")}</h2>
      <p>{t("legal.terms.sections.acceptableUse.body")}</p>
      <ul>
        <li>{t("legal.terms.sections.acceptableUse.items.unlawful")}</li>
        <li>{t("legal.terms.sections.acceptableUse.items.unauthorized")}</li>
        <li>{t("legal.terms.sections.acceptableUse.items.interfere")}</li>
        <li>{t("legal.terms.sections.acceptableUse.items.reverse")}</li>
      </ul>

      <h2>{t("legal.terms.sections.educational.title")}</h2>
      <p>{t("legal.terms.sections.educational.body")}</p>

      <h2>{t("legal.terms.sections.subscriptions.title")}</h2>
      <p>{t("legal.terms.sections.subscriptions.body")}</p>

      <h2>{t("legal.terms.sections.thirdParty.title")}</h2>
      <p>{t("legal.terms.sections.thirdParty.body")}</p>

      <h2>{t("legal.terms.sections.ip.title")}</h2>
      <p>{t("legal.terms.sections.ip.body")}</p>

      <h2>{t("legal.terms.sections.disclaimers.title")}</h2>
      <p>{t("legal.terms.sections.disclaimers.body")}</p>

      <h2>{t("legal.terms.sections.liability.title")}</h2>
      <p>{t("legal.terms.sections.liability.body")}</p>

      <h2>{t("legal.terms.sections.indemnity.title")}</h2>
      <p>{t("legal.terms.sections.indemnity.body")}</p>

      <h2>{t("legal.terms.sections.termination.title")}</h2>
      <p>{t("legal.terms.sections.termination.body")}</p>

      <h2>{t("legal.terms.sections.changes.title")}</h2>
      <p>{t("legal.terms.sections.changes.body")}</p>

      <h2>{t("legal.terms.sections.law.title")}</h2>
      <p>{t("legal.terms.sections.law.body")}</p>

      <h2>{t("legal.terms.sections.contact.title")}</h2>
      <p>
        {t("legal.terms.sections.contact.body")}{" "}
        <a href="mailto:monevo.educational@gmail.com">
          monevo.educational@gmail.com
        </a>
      </p>
    </LegalPageLayout>
  );
};

export default TermsOfService;
