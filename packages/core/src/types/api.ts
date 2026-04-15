export type FinancialProfile = {
  goal_types?: string[];
  timeframe?: string;
  risk_comfort?: string;
  income_range?: string;
  savings_rate_estimate?: string;
  investing_experience?: string;
};

export type UserProfile = {
  id?: number | string;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  points?: number;
  has_paid?: boolean;
  is_questionnaire_completed?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  subscription_plan_id?: string | null;
  user_data?: Record<string, unknown>;
  financial_profile?: FinancialProfile;
  profile_avatar?: string;
  profile_avatar_url?: string;
  avatar?: string;
  avatar_url?: string;
  referral_code?: string;
  streak?: number;
  streak_meta?: {
    next_milestone?: number | null;
    days_to_next_milestone?: number;
    streak_at_risk?: boolean;
  };
  daily_goal?: {
    target_xp?: number;
    earned_xp_today?: number;
    progress_pct?: number;
  };
  weekly_recap?: {
    week_start?: string;
    xp_earned?: number;
    missions_completed?: number;
    streak_days?: number;
  };
  earned_money?: number | string;
  stripe_subscription_id?: string | null;
  reviews_due?: number;
  activity_calendar?: Record<string, unknown>;
  /** Per-day counts for dashboard heatmap (lessons / sections / exercises / quizzes). */
  activity_calendar_by_type?: Record<
    string,
    {
      lessons?: number;
      sections?: number;
      exercises?: number;
      quizzes?: number;
    }
  >;
  current_month?: {
    first_day?: string | number | Date;
    last_day?: string | number | Date;
    month_name?: string;
    year?: number | string;
  };
  user?: {
    username?: string;
    email?: string;
    avatar?: string;
    avatar_url?: string;
    profile_avatar?: string;
    profile_avatar_url?: string;
  };
};

export type EntitlementFeature = {
  flag?: string;
  name?: string;
  enabled?: boolean;
  used_today?: number;
  remaining_today?: number;
};

export type Entitlements = {
  plan?: string;
  label?: string | null;
  entitled?: boolean;
  status?: string | null;
  trialEnd?: string | null;
  trial_end?: string | null;
  features?: Record<string, EntitlementFeature>;
  subscription?: Record<string, unknown> | null;
  fallback?: boolean;
  checked_at?: string;
};

export type Mission = {
  id: number | string;
  name?: string;
  description?: string;
  points_reward?: number;
  progress?: number;
  status?: "not_started" | "in_progress" | "completed" | string;
  goal_type?: string;
  goal_reference?: Record<string, any>;
  purpose_statement?: string;
  mission_name?: string;
};

export type MissionBuckets = {
  daily_missions?: Mission[];
  weekly_missions?: Mission[];
  can_swap?: boolean;
};

export type ProgressSummary = {
  overall_progress?: number;
  completed_sections?: number;
  total_sections?: number;
  completed_lessons?: number;
  total_lessons?: number;
  paths?: Array<{
    path?: string | null;
    path_id?: number | null;
    course?: string;
    course_id?: number;
    percent_complete?: number;
    completed_sections?: number;
    total_sections?: number;
    completed_lessons?: number;
    total_lessons?: number;
  }>;
  /** Last place in the lesson flow (for "Pick up where you left off") */
  resume?: {
    course_id: number;
    course_title: string;
    flow_current_index: number;
    path_id?: number | null;
  } | null;
  /** First course of first accessible path (for "Browse topics" when no resume) */
  start_here?: { path_id: number; course_id: number } | null;
};

export type PersonalizedPathCourse = {
  id: number;
  path?: number;
  path_title?: string;
  title?: string;
  description?: string;
  image?: string | null;
  completed_lessons?: number;
  total_lessons?: number;
  completion_percent?: number;
  estimated_minutes?: number;
  reason?: string;
  locked?: boolean;
  completed_sections?: number;
  total_sections?: number;
  next_lesson_title?: string | null;
  starter_tasks?: string[];
};

export type PersonalizedPathResponse = {
  courses: PersonalizedPathCourse[];
  meta?: {
    generated_at?: string;
    onboarding_goals?: string[];
    refresh_available?: boolean;
    overall_completion?: number;
    preview?: boolean;
  };
  review_queue?: Array<{
    skill?: string;
    proficiency?: number;
    due_at?: string | null;
  }>;
  upgrade_prompt?: string;
  message?: string;
  redirect?: string;
  error?: string;
};
