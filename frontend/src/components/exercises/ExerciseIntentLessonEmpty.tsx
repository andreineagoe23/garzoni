import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Props =
  | {
      variant: "unmapped";
      skill: string;
      onViewAllExercises: () => void;
      onOpenFilters: () => void;
    }
  | {
      variant: "mapped_zero";
      category: string;
      onClearFilter: () => void;
      onOpenFilters: () => void;
    }
  | {
      variant: "generic_filtered";
      onClearFilter?: () => void;
    };

/**
 * Lesson-mode empty list: separates “could not map skill” vs “category has no exercises” vs generic filter empty.
 */
export default function ExerciseIntentLessonEmpty(props: Props) {
  const { t } = useTranslation();

  if (props.variant === "unmapped") {
    return (
      <div className="border-b border-white/20 py-10 text-center">
        <p className="text-base font-semibold text-[color:var(--text-color,#111827)]">
          {t("exercises.emptyUnmapped.title", { skill: props.skill })}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("exercises.emptyUnmapped.subtitle")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={props.onViewAllExercises}
            className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30"
          >
            {t("exercises.emptyUnmapped.viewAll")}
          </button>
          <button
            type="button"
            onClick={props.onOpenFilters}
            className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40"
          >
            {t("exercises.emptyUnmapped.pickCategory")}
          </button>
          <Link
            to="/all-topics"
            className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40"
          >
            {t("exercises.emptyUnmapped.browseLessons")}
          </Link>
        </div>
      </div>
    );
  }

  if (props.variant === "mapped_zero") {
    return (
      <div className="border-b border-white/20 py-10 text-center">
        <p className="text-base font-semibold text-[color:var(--text-color,#111827)]">
          {t("exercises.emptyMappedZero.title", { category: props.category })}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("exercises.emptyMappedZero.subtitle")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={props.onClearFilter}
            className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30"
          >
            {t("exercises.emptyMappedZero.clearFilter")}
          </button>
          <button
            type="button"
            onClick={props.onOpenFilters}
            className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40"
          >
            {t("exercises.emptyMappedZero.pickAnother")}
          </button>
          <Link
            to="/all-topics"
            className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40"
          >
            {t("exercises.emptyMappedZero.goToLessons")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/20 py-10 text-center">
      <p className="text-base font-semibold text-[color:var(--text-color,#111827)]">
        {t("exercises.emptyFiltered.title")}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted-text,#6b7280)]">
        {t("exercises.emptyFiltered.subtitle")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {props.onClearFilter ? (
          <button
            type="button"
            onClick={props.onClearFilter}
            className="rounded-full bg-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30"
          >
            {t("exercises.skillIntent.clearFilter")}
          </button>
        ) : null}
        <Link
          to="/all-topics"
          className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] hover:border-[color:var(--primary,#1d5330)]/40"
        >
          {t("exercises.emptyFiltered.browseTopics")}
        </Link>
      </div>
    </div>
  );
}
