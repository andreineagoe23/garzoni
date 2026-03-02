import React from "react";
import { Link } from "react-router-dom";
import LegalPageLayout from "components/legal/LegalPageLayout";
import { Trans, useTranslation } from "react-i18next";

const FinancialDisclaimer = () => {
  const { t } = useTranslation();
  return (
    <LegalPageLayout
      lastUpdated={t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
      title={t("legal.financialDisclaimer.title")}
    >
      <p>
        <Trans
          i18nKey="legal.financialDisclaimer.intro"
          components={{ strong: <strong /> }}
        />
      </p>

      <h2>{t("legal.financialDisclaimer.sections.meaning.title")}</h2>
      <ul>
        <li>{t("legal.financialDisclaimer.sections.meaning.items.general")}</li>
        <li>
          {t("legal.financialDisclaimer.sections.meaning.items.noProfile")}
        </li>
        <li>
          {t(
            "legal.financialDisclaimer.sections.meaning.items.noRecommendation"
          )}
        </li>
        <li>
          {t("legal.financialDisclaimer.sections.meaning.items.examples")}
        </li>
        <li>
          {t(
            "legal.financialDisclaimer.sections.meaning.items.pastPerformance"
          )}
        </li>
      </ul>

      <h2>{t("legal.financialDisclaimer.sections.responsibility.title")}</h2>
      <p>{t("legal.financialDisclaimer.sections.responsibility.body")}</p>

      <h2>{t("legal.financialDisclaimer.sections.warranty.title")}</h2>
      <p>{t("legal.financialDisclaimer.sections.warranty.body")}</p>

      <h2>{t("legal.financialDisclaimer.sections.related.title")}</h2>
      <p>
        <Trans
          i18nKey="legal.financialDisclaimer.sections.related.body"
          components={{
            noAdvice: <Link to="/no-financial-advice" />,
            terms: <Link to="/terms-of-service" />,
            privacy: <Link to="/privacy-policy" />,
          }}
        />
      </p>
    </LegalPageLayout>
  );
};

export default FinancialDisclaimer;
