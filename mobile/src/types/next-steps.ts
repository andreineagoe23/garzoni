export type StepCategory = 'learn' | 'action' | 'review' | 'explore';

export type NextStep = {
  id: string;
  title: string;
  description: string;
  category: StepCategory;
  xp: number;
};

export type NextStepsResponse = {
  steps: NextStep[];
  completed_today: number;
  limit: number;
};

export const CATEGORY_LABELS: Record<StepCategory, string> = {
  learn: 'Learn',
  action: 'Action',
  review: 'Review',
  explore: 'Explore',
};

export const CATEGORY_COLORS: Record<StepCategory, string> = {
  learn: '#3b82f6',
  action: '#10b981',
  review: '#f59e0b',
  explore: '#8b5cf6',
};

/** Fallback steps when API is unavailable */
export const DEMO_STEPS: NextStep[] = [
  {
    id: 'demo-1',
    title: 'Check your savings rate',
    description: 'Run the Goals Reality Check to see if your savings pace matches your goals.',
    category: 'action',
    xp: 10,
  },
  {
    id: 'demo-2',
    title: 'Learn about inflation',
    description: 'Understanding CPI helps you plan purchasing power over time.',
    category: 'learn',
    xp: 5,
  },
  {
    id: 'demo-3',
    title: 'Explore market indices',
    description: 'Get a feel for major markets before making investment decisions.',
    category: 'explore',
    xp: 5,
  },
];
