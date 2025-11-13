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

const ToolsPage = () => {
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState(null);

  const categories = [
    {
      title: "Portfolio Analyzer",
      description:
        "Track and analyze your stock and cryptocurrency investments",
      component: <PortfolioAnalyzer />,
    },
    {
      title: "Financial Goals Tracker",
      description:
        "Set and track your personal financial goals with progress indicators",
      component: <FinancialGoalsTracker />,
    },
    {
      title: "Savings Goal Calculator",
      description:
        "Calculate how long it will take to reach your savings goals",
      component: <SavingsGoalCalculator />,
    },
    {
      title: "Crypto Tools",
      description: "Track cryptocurrency prices and market trends",
      component: <CryptoTools />,
    },
    {
      title: "Forex Tools",
      description: "Monitor foreign exchange rates and currency pairs",
      component: <ForexTools />,
    },
    {
      title: "News & Economic Calendar",
      description: "Stay updated with financial news and economic events",
      component: <NewsCalendars />,
    },
  ];

  if (!isAuthenticated) {
    return (
      <PageContainer maxWidth="4xl" layout="centered" className="py-16">
        <GlassCard padding="xl" className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-semibold text-[color:var(--accent,#111827)]">
            Please log in to access financial tools
          </h2>
          <p className="max-w-xl text-sm text-[color:var(--muted-text,#6b7280)]">
            These tools are available to registered users only. Sign in to
            explore personalized analysis, calculators, and live market data.
          </p>
        </GlassCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="6xl" layout="none" innerClassName="space-y-8">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
            Productivity Suite
          </p>
          <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
            Financial Tools
          </h1>
          <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
            Explore interactive tools for tracking markets, planning goals, and
            managing your portfolio.
          </p>
        </header>

        <div className="flex flex-col gap-6">
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
                        <div className="rounded-2xl bg-[color:var(--bg-color,#f8fafc)]/60 backdrop-blur-sm px-4 py-4 shadow-inner border border-white/20" style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
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
