/** Shared types for course lesson editor — keep in a tiny module so CourseFlowPage can lazy-load the panel without a static JS edge to it. */
export type LessonSection = {
  id?: number;
  title?: string;
  text_content?: string;
  content_type?: string;
  video_url?: string;
  order?: number;
  exercise_type?: string;
  exercise_data?: Record<string, unknown>;
  is_published?: boolean;
};
