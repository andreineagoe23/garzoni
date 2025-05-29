import React, { useState } from "react";
import { Container, Accordion } from "react-bootstrap";
import { useAuth } from "./AuthContext";
import PortfolioAnalyzer from "./PortfolioAnalyzer";
import SavingsGoalCalculator from "./SavingsGoalCalculator";
import CryptoTools from "./CryptoTools";
import ForexTools from "./ForexTools";
import NewsCalendars from "./NewsCalendars";
import FinancialGoalsTracker from "./FinancialGoalsTracker";
import ErrorBoundary from "./ErrorBoundary";

const ToolsPage = () => {
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState(null);

  const handleAccordionToggle = (category) => {
    setActiveCategory(activeCategory === category ? null : category);
  };

  const categories = [
    {
      title: "Portfolio Analyzer",
      component: <PortfolioAnalyzer />,
      description:
        "Track and analyze your stock and cryptocurrency investments",
    },
    {
      title: "Financial Goals Tracker",
      component: <FinancialGoalsTracker />,
      description:
        "Set and track your personal financial goals with progress indicators",
    },
    {
      title: "Savings Goal Calculator",
      component: <SavingsGoalCalculator />,
      description:
        "Calculate how long it will take to reach your savings goals",
    },
    {
      title: "Crypto Tools",
      component: <CryptoTools />,
      description: "Track cryptocurrency prices and market trends",
    },
    {
      title: "Forex Tools",
      component: <ForexTools />,
      description: "Monitor foreign exchange rates and currency pairs",
    },
    {
      title: "News & Economic Calendar",
      component: <NewsCalendars />,
      description: "Stay updated with financial news and economic events",
    },
  ];

  if (!isAuthenticated) {
    return (
      <Container className="py-5 text-center">
        <h2>Please log in to access financial tools</h2>
        <p>These tools are available to registered users only.</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="mb-4">Financial Tools</h1>
      <Accordion activeKey={activeCategory?.toString()}>
        {categories.map((category, index) => (
          <ErrorBoundary key={index}>
            <Accordion.Item eventKey={index.toString()} className="mb-3">
              <Accordion.Header
                onClick={() => handleAccordionToggle(index)}
                className="fw-semibold"
              >
                {category.title}
              </Accordion.Header>
              <Accordion.Body>
                <p className="text-muted mb-3">{category.description}</p>
                {category.component}
              </Accordion.Body>
            </Accordion.Item>
          </ErrorBoundary>
        ))}
      </Accordion>
    </Container>
  );
};

export default ToolsPage;
