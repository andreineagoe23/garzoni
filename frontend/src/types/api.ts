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
  user_data?: Record<string, unknown>;
  profile_avatar?: string;
  profile_avatar_url?: string;
  avatar?: string;
  avatar_url?: string;
  referral_code?: string;
  streak?: number;
  earned_money?: number | string;
  stripe_subscription_id?: string | null;
  reviews_due?: number;
  activity_calendar?: Record<string, unknown>;
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
  status?: "in_progress" | "complete" | string;
  goal_type?: string;
  goal_reference?: Record<string, any>;
  mission_name?: string;
};

export type MissionBuckets = {
  daily_missions?: Mission[];
  weekly_missions?: Mission[];
};

export type ProgressSummary = {
  overall_progress?: number;
  paths?: Array<{ percent_complete?: number }>;
};
