/**
 * Centralized RO locale: merge common + shared + courses + editorial + calculators.
 * Add more domain files here to keep each file small and avoid repetition.
 */
import common from "./common.json";
import shared from "./shared.json";
import courses from "./courses.json";
import editorial from "./editorial.json";
import calculators from "./calculators.json";

export default {
  ...common,
  shared,
  courses,
  editorial,
  calculators,
} as typeof common & {
  shared: typeof shared;
  courses: typeof courses;
  editorial: typeof editorial;
  calculators: typeof calculators;
};
