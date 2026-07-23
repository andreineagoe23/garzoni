import apiClient from "./httpClient";
import type {
  ProgressSummary,
  WhatsNextAction,
  UserProfile,
  MissionBuckets,
  MissionDelta,
  PersonalizedPathResponse,
} from "types/api";

export const fetchProfile = () => apiClient.get<UserProfile>("/userprofile/");

/** Last N calendar days with separate lesson / section / exercise / quiz counts (dashboard heatmap). */
export type ActivityHeatmapDay = {
  date: string;
  totalActivities?: number;
  lessonsCompleted?: number;
  sectionsCompleted?: number;
  exercisesCompleted?: number;
  quizzesCompleted?: number;
};

export const fetchActivityHeatmap = (days = 90) =>
  apiClient.get<ActivityHeatmapDay[]>("/activity-heatmap/", {
    params: { days: Math.max(1, Math.min(365, days)) },
  });

// subscription_plan_id is server-set by billing webhooks only; the backend
// ignores it here, so it is intentionally not part of this request body.
export const patchUserProfile = (body: {
  email_reminder_preference?: string;
}) => apiClient.patch<{ message?: string }>("/userprofile/", body);

export const fetchLearningPaths = () => apiClient.get("/paths/");

export const fetchLesson = (lessonId: string | number) =>
  apiClient.get(`/lessons/${lessonId}/`);

export const fetchProgressSummary = () =>
  apiClient.get<ProgressSummary>("/userprogress/progress_summary/");

export const fetchWhatsNext = () =>
  apiClient.get<WhatsNextAction>("/whats-next/");

export const fetchLearningPathCourses = (pathId: string | number) =>
  apiClient.get(`/courses/`, { params: { path: pathId } });

export const fetchLessonsWithProgress = (
  courseId: string | number,
  includeUnpublished?: boolean,
) =>
  apiClient.get(`/lessons/with_progress/`, {
    params: {
      course: courseId,
      include_unpublished: includeUnpublished,
    },
  });

export const fetchCourseById = (courseId: string | number) =>
  apiClient.get(`/courses/${courseId}/`);

export const fetchExercises = () => apiClient.get(`/exercises/`);

export const fetchExerciseCategories = (opts?: { asLearner?: boolean }) =>
  apiClient.get<string[]>("/exercises/categories/", {
    params: opts?.asLearner ? { as_learner: "1" } : undefined,
  });

export const fetchExercisesList = (params?: {
  type?: string;
  category?: string;
  difficulty?: string;
  /** Match production learner catalog (published, non–internal category) even for staff. */
  asLearner?: boolean;
}) => {
  const { asLearner, ...rest } = params ?? {};
  const q: Record<string, string> = {};
  if (rest.type) q.type = rest.type;
  if (rest.category) q.category = rest.category;
  if (rest.difficulty) q.difficulty = rest.difficulty;
  if (asLearner) q.as_learner = "1";
  return apiClient.get("/exercises/", { params: q });
};

export const fetchExerciseById = (id: string | number) =>
  apiClient.get(`/exercises/${id}/`);

/** POST /exercises/:id/submit/ — same contract as web ExercisePage. */
export type ExerciseSubmitResponse = {
  correct: boolean;
  attempts?: number;
  explanation?: string | null;
  feedback?: string | null;
  xp_delta?: number;
  due_at?: string | null;
  proficiency?: number;
  level_band?: string;
  level_label?: string;
  skill?: string;
  first_unlock?: boolean;
  coins_delta?: number;
};

export type ExerciseSubmitBody = {
  user_answer: unknown;
  hints_used?: number;
  confidence?: string;
  /** Lesson section when submitting from in-lesson practice (catalog exercise). */
  section_id?: string | number;
};

export const submitExerciseAnswer = (
  exerciseId: string | number,
  body: ExerciseSubmitBody,
) =>
  apiClient.post<ExerciseSubmitResponse>(
    `/exercises/${exerciseId}/submit/`,
    body,
  );

export type ExerciseProgressPayload = {
  completed?: boolean;
  attempts?: number;
  user_answer?: unknown;
};

export const fetchExerciseProgress = (exerciseId: string | number) =>
  apiClient.get<ExerciseProgressPayload>(`/exercises/progress/${exerciseId}/`);

export type LeaderboardEntry = {
  user?: {
    id?: number;
    username?: string;
    profile_avatar?: string | null;
  };
  points?: number;
  rank?: number;
};

export const fetchLeaderboardGlobal = (
  timeFilter = "all-time",
  skill?: string | null,
) =>
  apiClient.get<LeaderboardEntry[]>("/leaderboard/", {
    params: { time_filter: timeFilter, ...(skill ? { skill } : {}) },
  });

export const fetchLeaderboardFriends = () =>
  apiClient.get<LeaderboardEntry[]>("/leaderboard/friends/");

export const fetchLeaderboardRank = () =>
  apiClient.get<LeaderboardEntry>("/leaderboard/rank/");

/** Incoming pending requests for the current user (receiver). */
export type FriendRequestIncoming = {
  id: number;
  sender: { id: number; username: string };
  receiver: { id: number; username: string };
  status?: string;
  created_at?: string;
};

/** Any request the user sent (all statuses); used for pending-by-receiver checks. */
export type FriendRequestSent = {
  id: number;
  sender?: { id: number; username: string };
  receiver: { id: number; username: string };
  status?: string;
};

export type FriendUserBrief = { id: number; username: string };

export const fetchIncomingFriendRequests = () =>
  apiClient.get<FriendRequestIncoming[]>("/friend-requests/");

export const fetchSentFriendRequests = () =>
  apiClient.get<FriendRequestSent[]>("/friend-requests/get_sent_requests/");

export const fetchFriendsList = () =>
  apiClient.get<FriendUserBrief[]>("/friend-requests/get_friends/");

export type PublicProfileSkill = { name: string; proficiency: number };

export type PublicProfileBadge = {
  id: number;
  name: string;
  image: string | null;
  level: "bronze" | "silver" | "gold" | string;
  earned_at: string | null;
};

export type PublicProfileHeatmapDay = {
  date: string;
  totalActivities: number;
  lessonsCompleted: number;
  sectionsCompleted: number;
  exercisesCompleted: number;
  quizzesCompleted: number;
};

export type PublicProfileVsYou = {
  xp_diff: number;
  rank_diff: number | null;
  streak_diff: number;
} | null;

export type PublicProfileFriendship = {
  is_self: boolean;
  is_friend: boolean;
  request_pending_outgoing: boolean;
  request_pending_incoming: boolean;
};

export type PublicProfileOpenDuel = {
  id: number;
  status: "pending" | "active";
  ends_at: string | null;
  viewer_is_challenger: boolean;
};

export type PublicProfile = {
  id: number;
  username: string;
  profile_avatar?: string | null;
  points: number;
  streak: number;
  rank: number | null;
  lessons_completed: number;
  missions_completed: number;
  badges_count: number;
  joined_at: string | null;
  last_active_at: string | null;
  skills: PublicProfileSkill[];
  badges: PublicProfileBadge[];
  activity_heatmap: PublicProfileHeatmapDay[];
  vs_you: PublicProfileVsYou;
  friendship: PublicProfileFriendship;
  open_duel: PublicProfileOpenDuel | null;
};

export const fetchPublicProfile = (userId: number) =>
  apiClient.get<PublicProfile>(`/users/${userId}/public-profile/`);

export const sendFriendRequest = (receiverId: number) =>
  apiClient.post<{ message?: string }>("/friend-requests/", {
    receiver: receiverId,
  });

export const respondToFriendRequest = (
  requestId: number,
  action: "accept" | "reject",
) =>
  apiClient.put<{ message?: string }>(`/friend-requests/${requestId}/`, {
    action,
  });

export const fetchRewardsShop = () => apiClient.get("/rewards/shop/");
export const fetchRewardsDonate = () => apiClient.get("/rewards/donate/");
export const purchaseReward = (rewardId: number | string) =>
  apiClient.post("/purchases/", { reward_id: rewardId });

export type FeedbackPayload = {
  email?: string;
  topic?: string;
  message: string;
  feedback_type?: string;
  context_url?: string;
};
export const submitFeedback = (payload: FeedbackPayload) =>
  apiClient.post("/contact/", payload);

export type AppReviewPayload = {
  sentiment: "happy" | "neutral" | "unhappy";
  reasons?: string[];
  message?: string;
  routed_to_store?: boolean;
  platform?: string;
  app_version?: string;
};
export const submitAppReview = (payload: AppReviewPayload) =>
  apiClient.post("/app-review-feedback/", payload);

export const postSubscriptionPortal = () =>
  apiClient.post<{ url?: string }>("/subscriptions/portal/", {});

export const postSubscriptionSync = () =>
  apiClient.post<{ ok: boolean }>("/subscriptions/sync/", {});

export const postRevenueCatSync = (rcAppUserId?: string) =>
  apiClient.post<{
    ok: boolean;
    plan?: string;
    subscription_status?: string;
  }>("/revenuecat-sync/", {
    ...(rcAppUserId ? { rc_app_user_id: rcAppUserId } : {}),
  });

export const postSubscriptionCheckout = (body: {
  plan_id: string;
  billing_interval: string;
}) => {
  if (
    typeof navigator !== "undefined" &&
    String((navigator as { product?: string }).product || "") === "ReactNative"
  ) {
    throw new Error(
      "[garzoni/core] postSubscriptionCheckout must not be called from native. Use RevenueCat.",
    );
  }
  return apiClient.post<{ redirect_url?: string }>(
    "/subscriptions/create/",
    body,
  );
};

export type ActivePromo = {
  id: string;
  percent_off: number;
  ends_on: string;
};

export const fetchSubscriptionPlans = () =>
  apiClient.get<{ plans?: unknown[]; promo?: ActivePromo | null }>("/plans/");

export type BadgeCatalogItem = {
  id: number;
  name: string;
  description?: string;
  image_url: string;
};

export type UserBadgeItem = {
  earned_at: string;
  badge: { id: number };
};

export const fetchBadges = () => apiClient.get<BadgeCatalogItem[]>("/badges/");

export const fetchUserBadges = () =>
  apiClient.get<UserBadgeItem[]>("/user-badges/");

export type SupportEntry = {
  id: number;
  question: string;
  answer: string;
  category?: string;
  helpful_count?: number;
  not_helpful_count?: number;
  user_vote?: string;
};

export const fetchSupportEntries = () =>
  apiClient.get<SupportEntry[]>("/support/");

export const postContactForm = (body: {
  email: string;
  topic: string;
  message: string;
}) => apiClient.post<{ message?: string }>("/contact/", body);

export const completeSection = (sectionId: string | number) =>
  apiClient.post(`/userprogress/complete_section/`, { section_id: sectionId });

export type CompleteLessonResponse = {
  status?: string;
  streak?: number;
  missions?: MissionDelta[];
  /** Missions this specific action finished (server-detected transition). */
  missions_completed_now?: MissionDelta[];
  /** True when this completion set the user's first_lesson_at (first lesson ever). */
  is_first_lesson?: boolean;
  /** One-time bonus XP granted with the first lesson; null/absent when none. */
  first_lesson_bonus_xp?: number | null;
};

export const completeLesson = (lessonId: string | number) =>
  apiClient.post<CompleteLessonResponse>(`/userprogress/complete/`, {
    lesson_id: lessonId,
  });

/**
 * Mark every published section of a course complete (flow Finish). Idempotent;
 * closes the resume-gap so finishing the flow always lands the learner at 100%.
 */
export const completeCourse = (courseId: string | number) =>
  apiClient.post(`/userprogress/complete_course/`, { course_id: courseId });

/** Lesson checkpoint quizzes (materialized from in-flow multiple-choice sections). */
export const fetchLessonCheckpointQuizzes = (lessonId: string | number) =>
  apiClient.get<unknown[]>(`/quizzes/checkpoint/`, {
    params: { lesson: lessonId },
    /** Host shows its own checkpoint UX; avoid duplicate global error alerts (mobile). */
    skipGlobalErrorToast: true,
  });

export const reorderLessonSections = (
  lessonId: string | number,
  order: Array<string | number>,
) => apiClient.post(`/lessons/${lessonId}/sections/reorder/`, { order });

export const createLessonSection = (
  lessonId: string | number,
  payload: Record<string, unknown>,
) => apiClient.post(`/lessons/${lessonId}/sections/`, payload);

export const updateLessonSection = (
  lessonId: string | number,
  sectionId: string | number,
  payload: Record<string, unknown>,
) => apiClient.patch(`/lessons/${lessonId}/sections/${sectionId}/`, payload);

export const deleteLessonSection = (
  lessonId: string | number,
  sectionId: string | number,
) => apiClient.delete(`/lessons/${lessonId}/sections/${sectionId}/`);

export const fetchReviewQueue = () => apiClient.get("/review-queue/");

export const fetchMasterySummary = () => apiClient.get("/mastery-summary/");

export const fetchPersonalizedPath = () =>
  apiClient.get<PersonalizedPathResponse>("/personalized-path/");

export const postPersonalizedPathRefresh = () =>
  apiClient.post("/personalized-path/refresh/");

export type CoachBriefResponse = {
  brief?: string;
  cached?: boolean;
};

export const fetchCoachBrief = () =>
  apiClient.get<CoachBriefResponse>("/coach-brief/");

export const fetchMissions = () => apiClient.get<MissionBuckets>("/missions/");

export type FinanceFact = { id: number; text: string; category?: string };

/** GET random unread fact; 204 means none available — resolves without throwing. */
export const fetchFinanceFact = async (): Promise<{
  data: FinanceFact | null;
}> => {
  const res = await apiClient.get<FinanceFact>("/finance-fact/", {
    validateStatus: (s) => s === 200 || s === 204,
  });
  if (res.status === 204) return { data: null };
  return { data: res.data ?? null };
};

export const markFinanceFactRead = (factId: number) =>
  apiClient.post<{ message?: string }>("/finance-fact/", { fact_id: factId });

export const fetchSavingsBalance = () =>
  apiClient.get<{ balance: number }>("/savings-account/");

export const postSavingsDeposit = (amount: number) =>
  apiClient.post<{
    message?: string;
    balance: number;
    missions?: MissionDelta[];
  }>("/savings-account/", {
    amount,
  });

export type StreakItemDto = {
  type: string;
  quantity: number;
  expires_at?: string | null;
};

export const fetchStreakItems = () =>
  apiClient.get<{ items: StreakItemDto[] }>("/streak-items/");

export type UseStreakItemResult = {
  message?: string;
  method?: "inventory" | "coins";
  remaining?: number;
  remaining_coins?: number;
  streak?: number;
  error?: string;
};

export const postStreakItem = (item_type: "streak_freeze" | "streak_boost") =>
  apiClient.post<UseStreakItemResult>("/streak-items/", { item_type });

export const swapMission = (missionId: number) =>
  apiClient.post<{ message?: string }>("/missions/swap/", {
    mission_id: missionId,
  });

// Hearts (lives) system
export const fetchHearts = () => apiClient.get("/user/hearts/");
export const decrementHearts = (amount = 1) =>
  apiClient.post("/user/hearts/decrement/", { amount });
export const grantHearts = (amount = 1) =>
  apiClient.post("/user/hearts/grant/", { amount });
/**
 * Instant heart refill. Free users have a daily cap; when it is hit the server
 * still answers **200** with `refill_capped: true` and the unchanged hearts
 * payload rather than a 4xx — clients released before the cap existed call this
 * without a `.catch()`, and a rejected promise left their refill button dead
 * with no message. Branch on `refill_capped`, not on the status code.
 */
export type RefillHeartsResponse = {
  hearts?: number;
  max_hearts?: number;
  next_heart_in_seconds?: number | null;
  refill_capped?: boolean;
  upgrade_hint?: boolean;
  refill_daily_cap?: number;
  refills_used_today?: number;
  detail?: string;
};

export const refillHearts = () =>
  apiClient.post<RefillHeartsResponse>("/user/hearts/refill/", {});

/**
 * Register Expo push token for the signed-in user (mobile notifications).
 * `timeZone` is the device's IANA zone; the backend uses it to schedule evening
 * nudges in the user's own evening rather than the server's.
 */
export const submitExpoPushToken = (expoPushToken: string, timeZone?: string) =>
  apiClient.post<{ ok: boolean }>("/auth/push-token/", {
    expo_push_token: expoPushToken,
    ...(timeZone ? { timezone: timeZone } : {}),
  });

/** Clear Expo push token server-side so notifications can be disabled. */
export const clearExpoPushToken = () =>
  apiClient.post<{ ok: boolean }>("/auth/push-token/", {
    expo_push_token: "",
  });

// Immersive course flow state (per course)
export const fetchCourseFlowState = (courseId: string | number) =>
  apiClient.get("/userprogress/flow_state/", { params: { course: courseId } });
export const saveCourseFlowState = (
  courseId: string | number,
  currentIndex: number,
) =>
  apiClient.post("/userprogress/flow_state/", {
    course: courseId,
    current_index: currentIndex,
  });

export type RecentActivityItem = {
  type: string;
  action?: string;
  title?: string;
  name?: string;
  course?: string;
  lesson_id?: number;
  course_id?: number;
  /** Stable i18n key for ledger entries (e.g. `gamification.ledger.lesson_reward`). */
  label_key?: string;
  /** XP awarded for this entry, when present (ledger entries only). */
  points?: number;
  /** Coins awarded for this entry, as a string-decimal (ledger entries only). */
  coins?: string;
  timestamp?: string;
};

export const fetchRecentActivity = () =>
  apiClient.get<{ recent_activities: RecentActivityItem[] }>(
    "/recent-activity/",
  );

export type CourseQuiz = {
  id: number;
  course?: number;
  title?: string;
  question?: string;
  choices?: { text: string }[];
  correct_answer?: string;
  is_completed?: boolean;
};

export const fetchQuizzesForCourse = (courseId: string | number) =>
  apiClient.get<CourseQuiz[]>("/quizzes/", { params: { course: courseId } });

export const completeCourseQuiz = (body: {
  quiz_id: number;
  selected_answer: string;
}) =>
  apiClient.post<{
    message?: string;
    correct?: boolean;
    earned_money?: number;
    earned_points?: number;
    already_completed?: boolean;
  }>("/quizzes/complete/", body);

export type UserSettingsPayload = {
  dark_mode?: boolean;
  sound_enabled?: boolean;
  animations_enabled?: boolean;
  /** When false, mobile should stop registering push tokens with the backend/CIO. */
  push_notifications?: boolean;
  email_reminder_preference?: string;
  email_preferences?: Record<string, unknown>;
  profile?: Record<string, unknown>;
};

export type UserSettingsResponse = {
  dark_mode?: boolean;
  sound_enabled?: boolean;
  animations_enabled?: boolean;
  /** Mirror of `email_preferences.push_notifications`; older builds only had the nested one. */
  push_notifications?: boolean;
  email_reminder_preference?: string;
  email_preferences?: Record<string, unknown>;
  profile?: Record<string, unknown>;
};

export const fetchUserSettings = () =>
  apiClient.get<UserSettingsResponse>("/user/settings/");

/**
 * Read the push master switch out of a settings response.
 *
 * The value lives under `email_preferences.push_notifications`; the top-level
 * key is a newer mirror. Clients that only read the top level saw `undefined`
 * and treated push as enabled for everyone, which is why disabling it never
 * took effect. Defaults to enabled when neither key is present.
 */
export function resolvePushEnabled(
  settings: UserSettingsResponse | null | undefined,
): boolean {
  if (!settings) return true;
  if (typeof settings.push_notifications === "boolean") {
    return settings.push_notifications;
  }
  const nested = settings.email_preferences?.push_notifications;
  return typeof nested === "boolean" ? nested : true;
}

export type ReferralSummary = {
  referral_code: string;
  referrals_made: Array<{
    id: number;
    referred_user: { id: number; username: string };
    created_at: string;
    reward_status: string;
    earned_at: string | null;
    my_promo_code: string | null;
    my_promo_redeemed: boolean | null;
  }>;
  referral_received: ReferralSummary["referrals_made"][number] | null;
  earned_discount_code: string | null;
  earned_discount_redeemed: boolean;
};

export const fetchReferralSummary = () =>
  apiClient.get<ReferralSummary>("/referrals/");

export const patchUserSettings = (data: UserSettingsPayload) =>
  apiClient.patch<{
    message?: string;
    dark_mode?: boolean;
    sound_enabled?: boolean;
    animations_enabled?: boolean;
    push_notifications?: boolean;
    email_reminder_preference?: string;
    email_preferences?: Record<string, unknown>;
  }>("/user/settings/", data);
