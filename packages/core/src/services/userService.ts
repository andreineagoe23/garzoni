import apiClient from "./httpClient";
import type { ProgressSummary, UserProfile, MissionBuckets } from "types/api";

export const fetchProfile = () => apiClient.get<UserProfile>("/userprofile/");

export const fetchLearningPaths = () => apiClient.get("/paths/");

export const fetchLesson = (lessonId: string | number) =>
  apiClient.get(`/lessons/${lessonId}/`);

export const fetchProgressSummary = () =>
  apiClient.get<ProgressSummary>("/userprogress/progress_summary/");

export const fetchLearningPathCourses = (pathId: string | number) =>
  apiClient.get(`/courses/`, { params: { path: pathId } });

export const fetchLessonsWithProgress = (
  courseId: string | number,
  includeUnpublished?: boolean
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

export const fetchExerciseCategories = () =>
  apiClient.get<string[]>("/exercises/categories/");

export const fetchExercisesList = (params?: {
  type?: string;
  category?: string;
  difficulty?: string;
}) => apiClient.get("/exercises/", { params });

export const fetchExerciseById = (id: string | number) =>
  apiClient.get(`/exercises/${id}/`);

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

export const fetchRewardsShop = () => apiClient.get("/rewards/shop/");
export const fetchRewardsDonate = () => apiClient.get("/rewards/donate/");

export const postSubscriptionPortal = () =>
  apiClient.post<{ url?: string }>("/subscriptions/portal/", {});

export const postSubscriptionCheckout = (body: {
  plan_id: string;
  billing_interval: string;
}) => apiClient.post<{ redirect_url?: string }>("/subscriptions/create/", body);

export const fetchSubscriptionPlans = () =>
  apiClient.get<{ plans?: unknown[] }>("/plans/");

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

export const reorderLessonSections = (
  lessonId: string | number,
  order: Array<string | number>
) => apiClient.post(`/lessons/${lessonId}/sections/reorder/`, { order });

export const createLessonSection = (
  lessonId: string | number,
  payload: Record<string, unknown>
) => apiClient.post(`/lessons/${lessonId}/sections/`, payload);

export const updateLessonSection = (
  lessonId: string | number,
  sectionId: string | number,
  payload: Record<string, unknown>
) => apiClient.patch(`/lessons/${lessonId}/sections/${sectionId}/`, payload);

export const deleteLessonSection = (
  lessonId: string | number,
  sectionId: string | number
) => apiClient.delete(`/lessons/${lessonId}/sections/${sectionId}/`);

export const fetchReviewQueue = () => apiClient.get("/review-queue/");

export const fetchMasterySummary = () => apiClient.get("/mastery-summary/");

export const fetchMissions = () => apiClient.get<MissionBuckets>("/missions/");

export type FinanceFact = { id: number; text: string; category?: string };

export const fetchFinanceFact = () =>
  apiClient.get<FinanceFact>("/finance-fact/");

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
  currentIndex: number
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
    "/recent-activity/"
  );

export type CourseQuiz = {
  id: number;
  course?: number;
  title?: string;
  question?: string;
  choices?: { text: string }[];
  correct_answer?: string;
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
