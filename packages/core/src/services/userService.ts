import apiClient from "./httpClient";
import type {
  ProgressSummary,
  UserProfile,
  MissionBuckets,
  PersonalizedPathResponse,
} from "types/api";

export const fetchProfile = () => apiClient.get<UserProfile>("/userprofile/");

export const patchUserProfile = (body: {
  email_reminder_preference?: string;
  subscription_plan_id?: "starter" | "plus" | "pro" | null;
}) => apiClient.patch<{ message?: string }>("/userprofile/", body);

export const fetchLearningPaths = () => apiClient.get("/paths/");

export const fetchLesson = (lessonId: string | number) =>
  apiClient.get(`/lessons/${lessonId}/`);

export const fetchProgressSummary = () =>
  apiClient.get<ProgressSummary>("/userprogress/progress_summary/");

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

export const submitExerciseAnswer = (
  exerciseId: string | number,
  body: { user_answer: unknown; hints_used?: number; confidence?: string },
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

export const fetchLeaderboardGlobal = (timeFilter = "all-time") =>
  apiClient.get<LeaderboardEntry[]>("/leaderboard/", {
    params: { time_filter: timeFilter },
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

export const postSubscriptionPortal = () =>
  apiClient.post<{ url?: string }>("/subscriptions/portal/", {});

export const postSubscriptionSync = () =>
  apiClient.post<{ ok: boolean }>("/subscriptions/sync/", {});

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
  return apiClient.post<{ redirect_url?: string }>("/subscriptions/create/", body);
};

export const fetchSubscriptionPlans = () =>
  apiClient.get<{ plans?: unknown[] }>("/plans/");

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

export const completeLesson = (lessonId: string | number) =>
  apiClient.post(`/userprogress/complete/`, { lesson_id: lessonId });

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
  apiClient.post<{ message?: string; balance: number }>("/savings-account/", {
    amount,
  });

export type StreakItemDto = {
  type: string;
  quantity: number;
  expires_at?: string | null;
};

export const fetchStreakItems = () =>
  apiClient.get<{ items: StreakItemDto[] }>("/streak-items/");

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
export const refillHearts = () => apiClient.post("/user/hearts/refill/", {});

/** Register Expo push token for the signed-in user (mobile notifications). */
export const submitExpoPushToken = (expoPushToken: string) =>
  apiClient.post<{ ok: boolean }>("/auth/push-token/", {
    expo_push_token: expoPushToken,
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
  email_reminder_preference?: string;
  email_preferences?: Record<string, unknown>;
  profile?: Record<string, unknown>;
};

export const fetchUserSettings = () =>
  apiClient.get<{
    dark_mode?: boolean;
    sound_enabled?: boolean;
    animations_enabled?: boolean;
    email_reminder_preference?: string;
    email_preferences?: Record<string, unknown>;
    profile?: Record<string, unknown>;
  }>("/user/settings/");

export const patchUserSettings = (data: UserSettingsPayload) =>
  apiClient.patch<{
    message?: string;
    dark_mode?: boolean;
    sound_enabled?: boolean;
    animations_enabled?: boolean;
    email_reminder_preference?: string;
    email_preferences?: Record<string, unknown>;
  }>("/user/settings/", data);
