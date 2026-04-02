/**
 * Centralized EN locale: merge common + shared + courses.
 * Add more domain files here to keep each file small and avoid repetition.
 */
import common from "./common.json";
import shared from "./shared.json";
import courses from "./courses.json";

export default {
  ...common,
  shared,
  courses,
} as typeof common & { shared: typeof shared; courses: typeof courses };
