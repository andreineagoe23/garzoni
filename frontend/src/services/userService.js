import apiClient from "./httpClient";

export const fetchProfile = () => apiClient.get("/userprofile/");

export const fetchProgressSummary = () =>
  apiClient.get("/userprogress/progress_summary/");

export const fetchLearningPathCourses = (pathId) =>
  apiClient.get(`/learningpaths/${pathId}/courses/`);

export const fetchLessonsWithProgress = (courseId, includeUnpublished) =>
  apiClient.get(`/lessons/with_progress/`, {
    params: {
      course: courseId,
      include_unpublished: includeUnpublished,
    },
  });

export const fetchExercises = () => apiClient.get(`/exercises/`);

export const completeSection = (sectionId) =>
  apiClient.post(`/userprogress/complete_section/`, { section_id: sectionId });

export const completeLesson = (lessonId) =>
  apiClient.post(`/userprogress/complete/`, { lesson_id: lessonId });

export const reorderLessonSections = (lessonId, order) =>
  apiClient.post(`/lessons/${lessonId}/sections/reorder/`, { order });

export const createLessonSection = (lessonId, payload) =>
  apiClient.post(`/lessons/${lessonId}/sections/`, payload);

export const updateLessonSection = (lessonId, sectionId, payload) =>
  apiClient.patch(`/lessons/${lessonId}/sections/${sectionId}/`, payload);

export const deleteLessonSection = (lessonId, sectionId) =>
  apiClient.delete(`/lessons/${lessonId}/sections/${sectionId}/`);

export const fetchReviewQueue = () => apiClient.get("/review-queue/");

export const fetchMasterySummary = () => apiClient.get("/mastery-summary/");

export const fetchMissions = () => apiClient.get("/missions/");
