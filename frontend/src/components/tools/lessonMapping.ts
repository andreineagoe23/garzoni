export const CALENDAR_EXPLAINERS = [
  {
    id: "inflation",
    label: "CPI / Inflation",
    difficulty: "Beginner",
    why: "Signals rising prices that reduce purchasing power.",
    who: "Savers, borrowers, and anyone with a budget.",
    affects: "Savings rates, loan costs, everyday prices.",
    learnPath: "/all-topics?topic=inflation",
    tags: ["saver", "borrower"] },
  {
    id: "rates",
    label: "Central Bank Rates",
    difficulty: "Beginner",
    why: "Sets the baseline for borrowing and saving costs.",
    who: "Anyone with loans, mortgages, or savings accounts.",
    affects: "Mortgages, credit cards, savings yields.",
    learnPath: "/all-topics?topic=interest-rates",
    tags: ["saver", "borrower", "investor"] },
  {
    id: "jobs",
    label: "Jobs Report",
    difficulty: "Intermediate",
    why: "Shows labor strength which drives spending power.",
    who: "Workers, job seekers, investors.",
    affects: "Wages, consumer demand, rate decisions.",
    learnPath: "/all-topics?topic=employment",
    tags: ["investor"] },
  {
    id: "gdp",
    label: "GDP Growth",
    difficulty: "Intermediate",
    why: "Measures overall economic expansion or contraction.",
    who: "Investors and business owners.",
    affects: "Market sentiment, hiring, investment plans.",
    learnPath: "/all-topics?topic=gdp",
    tags: ["investor"] },
  {
    id: "retail",
    label: "Retail Sales",
    difficulty: "Intermediate",
    why: "Highlights consumer spending trends.",
    who: "Budgeters and market observers.",
    affects: "Company earnings, inflation outlook.",
    learnPath: "/all-topics?topic=consumer-spending",
    tags: ["saver", "investor"] },
  {
    id: "housing",
    label: "Housing Data",
    difficulty: "Advanced",
    why: "Reflects affordability and credit conditions.",
    who: "Home buyers, renters, and lenders.",
    affects: "Mortgage rates, rents, construction jobs.",
    learnPath: "/all-topics?topic=housing",
    tags: ["borrower"] },
];

export const NEWS_CATEGORY_LESSONS: Record<string, string> = {
  "Macro economy": "/all-topics?topic=inflation",
  "Personal finance": "/all-topics?topic=budgeting",
  Markets: "/all-topics?topic=investing",
  Crypto: "/all-topics?topic=crypto" };

export const PORTFOLIO_INSIGHT_LESSONS: Record<string, string> = {
  concentration: "/all-topics?topic=diversification",
  volatility: "/all-topics?topic=risk",
  diversification: "/all-topics?topic=investing" };

export const GOALS_LEVER_LESSONS: Record<string, string> = {
  expenses: "/all-topics?topic=budgeting",
  savings_rate: "/all-topics?topic=saving",
  income: "/all-topics?topic=career" };
