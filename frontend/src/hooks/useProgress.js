import { useProgressStore } from "stores/progressStore";

export function useProgress() {
  const courseFlow = useProgressStore((s) => s.courseFlow);
  const setCourseFlowProgress = useProgressStore((s) => s.setCourseFlowProgress);
  const resetCourseFlowProgress = useProgressStore(
    (s) => s.resetCourseFlowProgress
  );

  return { courseFlow, setCourseFlowProgress, resetCourseFlowProgress };
}


