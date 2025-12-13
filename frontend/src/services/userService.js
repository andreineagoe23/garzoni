import apiClient from "./httpClient";

export const fetchProfile = () => apiClient.get("/userprofile/");

export const fetchProgressSummary = () =>
  apiClient.get("/userprogress/progress_summary/");

export const fetchLearningPathCourses = (pathId) =>
  apiClient.get(`/courses/`, { params: { path: pathId } });

export const fetchLessonsWithProgress = (courseId, includeUnpublished) =>
  apiClient.get(`/lessons/with_progress/`, {
    params: {
      course: courseId,
      include_unpublished: includeUnpublished,
    },
  });

export const fetchCourseById = (courseId) =>
  apiClient.get(`/courses/${courseId}/`);

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

// Hearts (lives) system
export const fetchHearts = () => apiClient.get("/user/hearts/");
export const decrementHearts = (amount = 1) =>
  apiClient.post("/user/hearts/decrement/", { amount });
export const grantHearts = (amount = 1) =>
  apiClient.post("/user/hearts/grant/", { amount });
export const refillHearts = () => apiClient.post("/user/hearts/refill/", {});

// Immersive course flow state (per course)
export const fetchCourseFlowState = (courseId) =>
  apiClient.get("/userprogress/flow_state/", { params: { course: courseId } });
export const saveCourseFlowState = (courseId, currentIndex) =>
  apiClient.post("/userprogress/flow_state/", {
    course: courseId,
    current_index: currentIndex,
  });
