import apiClient from "./httpClient";
import type { ProgressSummary, UserProfile, MissionBuckets } from "types/api";

export const fetchProfile = () => apiClient.get<UserProfile>("/userprofile/");

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

// Hearts (lives) system
export const fetchHearts = () => apiClient.get("/user/hearts/");
export const decrementHearts = (amount = 1) =>
  apiClient.post("/user/hearts/decrement/", { amount });
export const grantHearts = (amount = 1) =>
  apiClient.post("/user/hearts/grant/", { amount });
export const refillHearts = () => apiClient.post("/user/hearts/refill/", {});

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
