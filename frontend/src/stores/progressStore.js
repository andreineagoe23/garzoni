import { create } from "zustand";

export const useProgressStore = create((set) => ({
  // IMPORTANT GUARDRAIL:
  // This store is UI-only (animation / prop-drilling relief). Do NOT treat it as saved progress.
  // Canonical progress truth comes from React Query (queryKeys.progressSummary()).

  // Intended for cross-cutting UI progress (e.g. course flow progress bar, global loaders).
  courseFlow: {
    courseId: null,
    currentIndex: 0,
    totalSteps: 0,
    percent: 0,
    courseComplete: false,
  },

  setCourseFlowProgress: (next) =>
    set((state) => ({
      courseFlow: { ...state.courseFlow, ...next },
    })),

  resetCourseFlowProgress: () =>
    set({
      courseFlow: {
        courseId: null,
        currentIndex: 0,
        totalSteps: 0,
        percent: 0,
        courseComplete: false,
      },
    }),
}));


