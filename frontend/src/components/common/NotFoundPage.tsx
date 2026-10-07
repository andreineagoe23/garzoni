import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import PageContainer from "components/common/PageContainer";

/**
 * Catch-all for URLs no route matches. Vercel still answers 200 with the SPA
 * shell, so the noindex is what keeps a mistyped or dead URL out of the index.
 */
export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <PageContainer maxWidth="3xl" layout="centered">
      <Helmet>
        <title>{t("notFoundPage.seoTitle")}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-content-primary">
          {t("notFoundPage.title")}
        </h1>
        <p className="text-content-muted">{t("notFoundPage.body")}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/"
            className="font-semibold text-brand-primary hover:underline"
          >
            {t("notFoundPage.home")}
          </Link>
          <Link
            to="/learn"
            className="font-semibold text-brand-primary hover:underline"
          >
            {t("notFoundPage.lessons")}
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
