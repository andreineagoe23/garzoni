/**
 * Maps mastery/skill labels from the dashboard to exercise API category names
 * when automatic fuzzy matching against /exercises/categories/ fails.
 * Keys are normalized lowercase; values must match a category string from the API.
 *
 * Learner-facing `/api/exercises/categories/` omits the internal bucket `General`
 * (see backend `education.exercise_visibility`); prefer concrete topics here so
 * deep links always resolve to a visible category.
 */
export const MASTERY_SKILL_TO_EXERCISE_CATEGORY: Record<string, string> = {
  budgeting: "Basic Finance",
  "personal finance": "Personal Finance",
  investing: "Investing",
  "basic finance": "Basic Finance",
  forex: "Forex",
  cryptocurrency: "Cryptocurrency",
  "real estate": "Real Estate",
  savings: "Personal Finance",
  inflation: "Basic Finance",
  diversification: "Investing",
  "emergency fund": "Personal Finance",
  "emergency funds": "Personal Finance",
  "risk management": "Investing",
  "credit score": "Basic Finance",
  credit: "Basic Finance",
  debt: "Personal Finance",
  loans: "Personal Finance",
  retirement: "Investing",
  taxes: "Basic Finance",
  insurance: "Personal Finance",
  "interest rates": "Basic Finance",
  stocks: "Investing",
  bonds: "Investing",
  portfolio: "Investing",
};
