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
        {/* rest of component unchanged, relying on updated i18n content */}
      </LegalPageLayout>
    </>
  );
};

export default FinancialDisclaimer;
