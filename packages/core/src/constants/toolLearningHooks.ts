export type ToolLearningHook = {
  toolSlug: string;
  lessonTopic: string;
  exerciseSkill: string;
  title: string;
  explainer: string;
  lessonRoute: string;
  exerciseRoute: string;
};

export const TOOL_LEARNING_HOOKS: Record<string, ToolLearningHook> = {
  "personal-cfo": {
    toolSlug: "personal-cfo",
    lessonTopic: "planning",
    exerciseSkill: "Planning",
    title: "Why this matters",
    explainer:
      "A financial plan connects goals, cash flow, and investing choices. Use this tool after learning the basics so each number has context.",
    lessonRoute: "/all-topics?topic=planning",
    exerciseRoute: "/exercises?skill=Planning&intentReason=tool_learning_hook",
  },
  "budget-planner": {
    toolSlug: "budget-planner",
    lessonTopic: "budgeting",
    exerciseSkill: "Budgeting",
    title: "Why this matters",
    explainer:
      "Budgets work best when you understand fixed and variable expenses. Practice the concept, then adjust your envelopes with intent.",
    lessonRoute: "/all-topics?topic=budgeting",
    exerciseRoute: "/exercises?skill=Budgeting&intentReason=tool_learning_hook",
  },
  "savings-calculator": {
    toolSlug: "savings-calculator",
    lessonTopic: "saving",
    exerciseSkill: "Saving",
    title: "Why this matters",
    explainer:
      "Savings goals are easier to reach when time, deposits, and compound growth are visible. The lesson gives the formula behind the projection.",
    lessonRoute: "/all-topics?topic=saving",
    exerciseRoute: "/exercises?skill=Saving&intentReason=tool_learning_hook",
  },
  "savings-goals": {
    toolSlug: "savings-goals",
    lessonTopic: "saving",
    exerciseSkill: "Saving",
    title: "Why this matters",
    explainer:
      "A goal is a habit plus a timeline. Learn the saving mechanics, then use the tool to set a realistic target.",
    lessonRoute: "/all-topics?topic=saving",
    exerciseRoute: "/exercises?skill=Saving&intentReason=tool_learning_hook",
  },
  portfolio: {
    toolSlug: "portfolio",
    lessonTopic: "investing",
    exerciseSkill: "Investing",
    title: "Why this matters",
    explainer:
      "Portfolio decisions depend on diversification, risk, and time horizon. Learn the concept before interpreting allocations.",
    lessonRoute: "/all-topics?topic=investing",
    exerciseRoute: "/exercises?skill=Investing&intentReason=tool_learning_hook",
  },
  "reality-check": {
    toolSlug: "reality-check",
    lessonTopic: "saving",
    exerciseSkill: "Goal Planning",
    title: "Why this matters",
    explainer:
      "A realistic goal balances time, income, and trade-offs. Practice the planning logic before changing your target.",
    lessonRoute: "/all-topics?topic=saving",
    exerciseRoute:
      "/exercises?skill=Goal%20Planning&intentReason=tool_learning_hook",
  },
  calendar: {
    toolSlug: "calendar",
    lessonTopic: "macro",
    exerciseSkill: "Macro Economy",
    title: "Why this matters",
    explainer:
      "Economic events move rates, currencies, and markets. Learn the signals so calendar dates become decisions, not noise.",
    lessonRoute: "/all-topics?topic=macro",
    exerciseRoute:
      "/exercises?skill=Macro%20Economy&intentReason=tool_learning_hook",
  },
  "economic-map": {
    toolSlug: "economic-map",
    lessonTopic: "macro",
    exerciseSkill: "Macro Economy",
    title: "Why this matters",
    explainer:
      "Maps make economic differences visible. The lesson helps explain why regions can have different inflation, rates, and growth.",
    lessonRoute: "/all-topics?topic=macro",
    exerciseRoute:
      "/exercises?skill=Macro%20Economy&intentReason=tool_learning_hook",
  },
  "news-context": {
    toolSlug: "news-context",
    lessonTopic: "markets",
    exerciseSkill: "Markets",
    title: "Why this matters",
    explainer:
      "Headlines are easier to judge when you understand market basics. Use the learning path to separate signal from noise.",
    lessonRoute: "/all-topics?topic=markets",
    exerciseRoute: "/exercises?skill=Markets&intentReason=tool_learning_hook",
  },
  "market-explorer": {
    toolSlug: "market-explorer",
    lessonTopic: "investing",
    exerciseSkill: "Investing",
    title: "Why this matters",
    explainer:
      "Quotes are only useful when you know what valuation, risk, and diversification mean. Practice first, then explore markets.",
    lessonRoute: "/all-topics?topic=investing",
    exerciseRoute: "/exercises?skill=Investing&intentReason=tool_learning_hook",
  },
  "next-steps": {
    toolSlug: "next-steps",
    lessonTopic: "planning",
    exerciseSkill: "Planning",
    title: "Why this matters",
    explainer:
      "Next actions stick when they connect to a skill. Learn the concept, practice once, then commit to the action.",
    lessonRoute: "/all-topics?topic=planning",
    exerciseRoute: "/exercises?skill=Planning&intentReason=tool_learning_hook",
  },
};

export function getToolLearningHook(toolSlug?: string | null) {
  if (!toolSlug) return null;
  return TOOL_LEARNING_HOOKS[toolSlug] ?? null;
}
