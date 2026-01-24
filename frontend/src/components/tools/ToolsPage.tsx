import React, { useState } from "react";
import PageContainer from "components/common/PageContainer";
import { useAuth } from "contexts/AuthContext";
import ErrorBoundary from "components/common/ErrorBoundary";
import PortfolioAnalyzer from "./PortfolioAnalyzer";
import SavingsGoalCalculator from "./SavingsGoalCalculator";
import CryptoTools from "./CryptoTools";
import ForexTools from "./ForexTools";
import NewsCalendars from "./NewsCalendars";
import FinancialGoalsTracker from "./FinancialGoalsTracker";
import { GlassCard } from "components/ui";
import FinancialSandbox from "./FinancialSandbox";
import { useTranslation } from "react-i18next";

const ToolsPage = () => {
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState(null);
  const { t } = useTranslation("tools");

  const categories = [
    {
      title: t("categories.portfolio.title"),
      description: t("categories.portfolio.description"),
      component: <PortfolioAnalyzer />,
    },
    {
      title: t("categories.goals.title"),
      description: t("categories.goals.description"),
      component: <FinancialGoalsTracker />,
    },
    {
      title: t("categories.savings.title"),
      description: t("categories.savings.description"),
      component: <SavingsGoalCalculator />,
    },
    {
      title: t("categories.crypto.title"),
      description: t("categories.crypto.description"),
      component: <CryptoTools />,
    },
    {
      title: t("categories.forex.title"),
      description: t("categories.forex.description"),
      component: <ForexTools />,
    },
    {
      title: t("categories.news.title"),
      description: t("categories.news.description"),
      component: <NewsCalendars />,
    },
    {
      title: t("categories.sandbox.title"),
      description: t("categories.sandbox.description"),
      component: <FinancialSandbox />,
    },
  ];

  if (!isAuthenticated) {
    return (
      <PageContainer maxWidth="4xl" layout="centered" className="py-16">
        <GlassCard
          padding="xl"
          className="flex flex-col items-center gap-4 text-center"
        >
          <h2 className="text-2xl font-semibold text-[color:var(--accent,#111827)]">
            {t("toolsPage.loginRequiredTitle")}
          </h2>
          <p className="max-w-xl text-sm text-[color:var(--muted-text,#6b7280)]">
            {t("toolsPage.loginRequiredBody")}
          </p>
        </GlassCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      maxWidth="7xl"
      layout="none"
      className="px-3 sm:px-6 lg:px-8"
      innerClassName="space-y-8 w-full"
    >
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
          {t("toolsPage.kicker", { defaultValue: "Productivity Suite" })}
        </p>
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          {t("toolsPage.title")}
        </h1>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("toolsPage.subtitle")}
        </p>
      </header>

      <div className="flex w-full flex-col gap-6 sm:mx-auto sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
        {categories.map((category, index) => {
          const isActive = activeCategory === index;
          return (
            <ErrorBoundary key={category.title}>
              <GlassCard
                className={`group ${isActive ? "ring-2 ring-[color:var(--accent,#2563eb)]/40" : ""}`}
                padding="none"
                hover={!isActive}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#2563eb)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCategory((prev) =>
                        prev === index ? null : index
                      )
                    }
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-[color:var(--accent,#111827)]">
                        {category.title}
                      </h2>
                      <p className="mt-1 text-sm text-[color:var(--muted-text,#6b7280)]">
                        {category.description}
                      </p>
                    </div>
                    <span className="text-sm text-[color:var(--muted-text,#6b7280)]">
                      {isActive ? "−" : "+"}
                    </span>
                  </button>

                  {isActive && (
                    <div className="border-t border-white/20 px-6 py-6">
                      <div
                        className="rounded-2xl bg-[color:var(--bg-color,#f8fafc)]/60 backdrop-blur-sm px-4 py-4 shadow-inner border border-white/20"
                        style={{
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                        }}
                      >
                        {category.component}
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            </ErrorBoundary>
          );
        })}
      </div>
    </PageContainer>
  );
};

export default ToolsPage;
