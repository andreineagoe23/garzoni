import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import LegalPageLayout from "components/legal/LegalPageLayout";
import { Trans, useTranslation } from "react-i18next";

const FinancialDisclaimer = () => {
  const { t } = useTranslation();
  return (
    <>
      <Helmet>
        <title>Financial Disclaimer | Garzoni</title>
      </Helmet>
      <LegalPageLayout
        lastUpdated={t("legal.lastUpdated", {
          date: t("legal.dates.feb7_2026"),
        })}
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
          <li>
            {t("legal.financialDisclaimer.sections.meaning.items.general")}
          </li>
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

        <h2>{t("legal.financialDisclaimer.sections.consumerDuty.title")}</h2>
        <p>{t("legal.financialDisclaimer.sections.consumerDuty.body")}</p>

        <h2>{t("legal.financialDisclaimer.sections.gamification.title")}</h2>
        <p>{t("legal.financialDisclaimer.sections.gamification.body")}</p>

        <h2>{t("legal.financialDisclaimer.sections.aiTutor.title")}</h2>
        <p>{t("legal.financialDisclaimer.sections.aiTutor.body")}</p>

        <h2 id="no-advice">{t("legal.noAdvice.title")}</h2>
        <p>
          <strong>{t("legal.noAdvice.intro")}</strong>
        </p>
        <h3>{t("legal.noAdvice.sections.regulatory.title")}</h3>
        <ul>
          <li>{t("legal.noAdvice.sections.regulatory.items.position")}</li>
          <li>{t("legal.noAdvice.sections.regulatory.items.fca")}</li>
          <li>{t("legal.noAdvice.sections.regulatory.items.euRegulation")}</li>
          <li>{t("legal.noAdvice.sections.regulatory.items.noAdvisor")}</li>
          <li>
            {t("legal.noAdvice.sections.regulatory.items.noRelationship")}
          </li>
          <li>{t("legal.noAdvice.sections.regulatory.items.consumerDuty")}</li>
        </ul>
        <h3>{t("legal.noAdvice.sections.infer.title")}</h3>
        <ul>
          <li>{t("legal.noAdvice.sections.infer.items.outputs")}</li>
          <li>{t("legal.noAdvice.sections.infer.items.workflows")}</li>
          <li>{t("legal.noAdvice.sections.infer.items.labels")}</li>
          <li>{t("legal.noAdvice.sections.infer.items.aiOutputs")}</li>
        </ul>
        <h3>{t("legal.noAdvice.sections.professional.title")}</h3>
        <p>{t("legal.noAdvice.sections.professional.body")}</p>

        <h2>{t("legal.financialDisclaimer.sections.related.title")}</h2>
        <p>
          <Trans
            i18nKey="legal.financialDisclaimer.sections.related.body"
            components={{
              terms: <Link to="/terms-of-service" />,
              privacy: <Link to="/privacy-policy" />,
            }}
          />
        </p>
      </LegalPageLayout>
    </>
  );
};

export default FinancialDisclaimer;
