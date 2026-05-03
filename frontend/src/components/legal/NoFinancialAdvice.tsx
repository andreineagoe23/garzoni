import React from "react";
import { Link } from "react-router-dom";
import LegalPageLayout from "components/legal/LegalPageLayout";
import { Trans, useTranslation } from "react-i18next";

const NoFinancialAdvice = () => {
  const { t } = useTranslation();
  return (
    <LegalPageLayout
      lastUpdated={t("legal.lastUpdated", { date: t("legal.dates.feb7_2026") })}
      title={t("legal.noAdvice.title")}
    >
      <p>
        <strong>{t("legal.noAdvice.intro")}</strong>
      </p>

      <h2>{t("legal.noAdvice.sections.regulatory.title")}</h2>
      <ul>
        <li>{t("legal.noAdvice.sections.regulatory.items.position")}</li>
        <li>{t("legal.noAdvice.sections.regulatory.items.fca")}</li>
        <li>{t("legal.noAdvice.sections.regulatory.items.euRegulation")}</li>
        <li>{t("legal.noAdvice.sections.regulatory.items.noAdvisor")}</li>
        <li>{t("legal.noAdvice.sections.regulatory.items.noRelationship")}</li>
        <li>{t("legal.noAdvice.sections.regulatory.items.consumerDuty")}</li>
      </ul>

      <h2>{t("legal.noAdvice.sections.infer.title")}</h2>
      <ul>
        <li>{t("legal.noAdvice.sections.infer.items.outputs")}</li>
        <li>{t("legal.noAdvice.sections.infer.items.workflows")}</li>
        <li>{t("legal.noAdvice.sections.infer.items.labels")}</li>
        <li>{t("legal.noAdvice.sections.infer.items.aiOutputs")}</li>
      </ul>

      <h2>{t("legal.noAdvice.sections.professional.title")}</h2>
      <p>{t("legal.noAdvice.sections.professional.body")}</p>

      <h2>{t("legal.noAdvice.sections.related.title")}</h2>
      <p>
        <Trans
          i18nKey="legal.noAdvice.sections.related.body"
          components={{
            financial: <Link to="/financial-disclaimer" />,
            terms: <Link to="/terms-of-service" />,
            privacy: <Link to="/privacy-policy" />,
          }}
        />
      </p>
    </LegalPageLayout>
  );
};

export default NoFinancialAdvice;
