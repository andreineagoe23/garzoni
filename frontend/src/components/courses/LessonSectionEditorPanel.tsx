import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { GlassButton, GlassCard } from "components/ui";
import { useTheme } from "../../contexts/ThemeContext";

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

type SavingState = {
  status?: "idle" | "saving" | "saved" | "error";
  message?: string;
};

type Exercise = {
  id?: number;
  title?: string;
  kind?: string;
  type?: string;
  exercise_data?: Record<string, unknown>;
  [key: string]: unknown;
};

const RichTextEditor = ({
  value,
  onChange }: {
  value?: string;
  onChange?: (nextValue: string) => void;
}) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any | null>(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedDataRef = useRef<string | null>(null);
  const valueRef = useRef(value || "");
  const { darkMode } = useTheme();
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    valueRef.current = value || "";
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const ClassicEditor = (
          await import("@ckeditor/ckeditor5-build-classic")
        ).default;

        if (cancelled || !containerRef.current) return;

        const editor = await ClassicEditor.create(containerRef.current);
        if (cancelled) {
          await editor.destroy();
          return;
        }

        editorRef.current = editor;
        editor.setData(valueRef.current);

        editor.model.document.on("change:data", () => {
          const data = editor.getData();
          lastEmittedDataRef.current = data;
          onChangeRef.current?.(data);
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("CKEditor failed to initialize", err);
        if (cancelled) return;
        setLoadError(t("courses.editor.loadFailed"));
      }
    })();

    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [t]); // initialize editor once per locale; callback updates via onChangeRef

  useEffect(() => {
    if (!wrapperRef.current) return;
    if (darkMode) {
      wrapperRef.current.setAttribute("data-theme", "dark");
    } else {
      wrapperRef.current.removeAttribute("data-theme");
    }
  }, [darkMode]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextValue = value || "";
    if (nextValue === lastEmittedDataRef.current) return;
    if (nextValue === editor.getData()) return;

    // Avoid blowing away the caret while the user is typing.
    const isFocused = editor.ui?.focusTracker?.isFocused;
    if (isFocused) return;

    editor.setData(nextValue);
  }, [value]);

  return (
    <div
      ref={wrapperRef}
      className="ckeditor-wrapper overflow-hidden rounded-xl border shadow-sm"
    >
      {loadError ? (
        <div className="p-3 text-sm text-[color:var(--error,#dc2626)]">
          {loadError}
        </div>
      ) : (
        <div ref={containerRef} className="ckeditor-container" />
      )}
    </div>
  );
};

const LessonSectionEditorPanel = ({
  section,
  onChange,
  onDelete,
  onPublishToggle,
  onSave,
  savingState,
  exercises,
  loadingExercises = false,
  onExerciseAttach,
  onCloseRequest,
  currentSectionTitle }: {
  section: LessonSection | null;
  onChange: (updates: Partial<LessonSection>) => void;
  onDelete: () => void;
  onPublishToggle: () => void;
  onSave: () => void;
  savingState?: SavingState;
  exercises?: Exercise[];
  loadingExercises?: boolean;
  onExerciseAttach?: (exercise: Exercise) => void;
  onCloseRequest: () => void;
  currentSectionTitle?: string;
}) => {
  const { t } = useTranslation();
  const [previewMode, setPreviewMode] = useState(false);
  const [exerciseJson, setExerciseJson] = useState("{}");
  const [lastValidExerciseJson, setLastValidExerciseJson] = useState("{}");
  const [jsonError, setJsonError] = useState("");
  const activeSectionIdRef = useRef<number | null>(null);
  const sectionExerciseDataRef = useRef<Record<string, unknown> | null>(null);
  const sanitizedPreviewHtml = useMemo(() => {
    if (!section?.text_content) return "";
    return DOMPurify.sanitize(section.text_content);
  }, [section?.text_content]);

  const getJsonErrorDetails = (value: string, error: unknown) => {
    const err = error as { message?: string } | null;
    const message = String(err?.message || t("courses.editor.invalidJson"));
    const match = message.match(/position\s+(\d+)/i);
    const position = match ? Number(match[1]) : null;
    if (position == null || Number.isNaN(position)) {
      return { message: t("courses.editor.invalidJsonDetail") };
    }

    const before = value.slice(0, position);
    const line = before.split("\n").length;
    const lastNewline = before.lastIndexOf("\n");
    const column = position - (lastNewline === -1 ? 0 : lastNewline + 1) + 1;

    return { line, column };
  };

  useEffect(() => {
    sectionExerciseDataRef.current = section?.exercise_data ?? null;
  }, [section?.exercise_data]);

  useEffect(() => {
    setPreviewMode(false);
    setJsonError("");
    activeSectionIdRef.current = section?.id ?? null;
    const exerciseData = sectionExerciseDataRef.current;
    const nextJson = exerciseData
      ? JSON.stringify(exerciseData, null, 2)
      : "{}";
    setExerciseJson(nextJson);
    setLastValidExerciseJson(nextJson);
  }, [section?.id]);

  useEffect(() => {
    // Only auto-sync when the user hasn't diverged from the last known valid JSON.
    if (!section) return;
    if (activeSectionIdRef.current !== (section?.id ?? null)) return;
    if (exerciseJson !== lastValidExerciseJson) return;

    const nextJson = section?.exercise_data
      ? JSON.stringify(section.exercise_data, null, 2)
      : "{}";
    setExerciseJson(nextJson);
    setLastValidExerciseJson(nextJson);
  }, [
    section?.exercise_data,
    section?.id,
    exerciseJson,
    lastValidExerciseJson,
    section,
  ]);

  const handleJsonChange = (value: string) => {
    setExerciseJson(value);
    try {
      const parsed = value ? JSON.parse(value) : {};
      onChange({ exercise_data: parsed });
      setJsonError("");
      setLastValidExerciseJson(value);
    } catch (err) {
      const details = getJsonErrorDetails(value, err);
      setJsonError(
        "message" in details
          ? details.message
          : t("courses.editor.invalidJsonAt", { line: details.line, column: details.column })
      );
    }
  };

  const handleContentTypeChange = (value: string) => {
    onChange({ content_type: value });

    if (value === "text") {
      onChange({ video_url: "", exercise_type: "", exercise_data: {} });
    }

    if (value === "video") {
      onChange({ exercise_type: "", exercise_data: {} });
    }
  };

  if (!section) {
    return (
      <GlassCard padding="lg" className="h-full min-h-0 space-y-4">
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          {t("courses.editor.selectSection")}
        </p>
        {currentSectionTitle && (
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            {t("courses.editor.currentSelection", {
              title: currentSectionTitle })}
          </p>
        )}
        <GlassButton variant="ghost" size="sm" onClick={onCloseRequest}>
          {t("courses.flow.closeEditor")}
        </GlassButton>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg" className="h-full min-h-0 flex flex-col">
      <header className="flex-none space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("courses.editor.adminMode")}
            </p>
            <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
              {section.title || t("courses.editor.untitledSection")}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                section.is_published
                  ? "bg-[color:rgba(var(--primary-rgb,29,83,48),0.18)] text-[color:var(--primary,#1d5330)]"
                  : "bg-[color:rgba(var(--accent-rgb,255,215,0),0.12)] text-[color:var(--accent,#FFD700)]"
              }`}
            >
              {section.is_published
                ? t("courses.editor.published")
                : t("courses.editor.draft")}
            </span>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode((prev) => !prev)}
            >
              {previewMode
                ? t("courses.editor.hidePreview")
                : t("courses.editor.showPreview")}
            </GlassButton>
            <GlassButton variant="primary" size="sm" onClick={onPublishToggle}>
              {section.is_published
                ? t("courses.editor.moveToDraft")
                : t("courses.editor.publish")}
            </GlassButton>
            <GlassButton variant="danger" size="sm" onClick={onDelete}>
              {t("shared.delete")}
            </GlassButton>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-text,#6b7280)]">
          {savingState?.status === "saving" && (
            <span>{t("courses.editor.autosaving")}</span>
          )}
          {savingState?.status === "saved" && (
            <span>{t("courses.editor.changesSaved")}</span>
          )}
          {savingState?.status === "error" && (
            <span className="text-[color:var(--error,#dc2626)]">
              {savingState?.message}
            </span>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 pt-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
            {t("courses.editor.title")}
          </label>
          <input
            value={section.title || ""}
            onChange={(event) => onChange({ title: event.target.value })}
            className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            placeholder={t("courses.editor.sectionTitlePlaceholder")}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              {t("courses.editor.contentType")}
            </label>
            <select
              value={section.content_type || "text"}
              onChange={(event) => handleContentTypeChange(event.target.value)}
              className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            >
              <option value="text">{t("courses.editor.contentTypeText")}</option>
              <option value="video">{t("courses.editor.contentTypeVideo")}</option>
              <option value="exercise">{t("courses.editor.contentTypeExercise")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              {t("courses.editor.order")}
            </label>
            <input
              type="number"
              value={section.order || 0}
              min={1}
              onChange={(event) =>
                onChange({ order: Number(event.target.value) })
              }
              className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            />
          </div>
        </div>

        {section.content_type === "text" && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              {t("courses.editor.body")}
            </label>
            <RichTextEditor
              value={section.text_content || ""}
              onChange={(value) => onChange({ text_content: value })}
            />
          </div>
        )}

        {section.content_type === "video" && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              {t("courses.editor.videoUrl")}
            </label>
            <input
              value={section.video_url || ""}
              onChange={(event) => onChange({ video_url: event.target.value })}
              className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              placeholder={t("courses.editor.videoUrlPlaceholder")}
            />
          </div>
        )}

        {section.content_type === "exercise" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                {t("courses.editor.exercisePicker")}
              </label>
              <select
                onChange={(event) => {
                  const picked = exercises?.find(
                    (exercise) => String(exercise.id) === event.target.value
                  );
                  if (picked) {
                    onExerciseAttach?.(picked);
                  }
                }}
                className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
                defaultValue=""
                disabled={loadingExercises}
              >
                <option value="">
                  {loadingExercises
                    ? t("courses.editor.loadingExercises")
                    : t("courses.editor.selectExercise")}
                </option>
                {exercises?.map((exercise: Exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {String(exercise.question || exercise.type || "Exercise")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                {t("courses.editor.exerciseJson")}
              </label>
              <textarea
                value={exerciseJson}
                onChange={(event) => handleJsonChange(event.target.value)}
                rows={6}
                className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              />
              {jsonError && (
                <p className="text-xs text-[color:var(--error,#dc2626)]">
                  {jsonError}
                </p>
              )}
            </div>
          </div>
        )}

        {previewMode && section.text_content && (
          <div className="space-y-2 rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-text,#6b7280)]">
              {t("courses.editor.preview")}
            </p>
            <div
              className="prose max-w-none text-[color:var(--text-color,#111827)] dark:prose-invert"
              dangerouslySetInnerHTML={{
                __html: sanitizedPreviewHtml }}
            />
          </div>
        )}
      </div>

      <div className="flex-none flex flex-wrap items-center gap-2 pt-4">
        <button
          type="button"
          className="rounded-full border border-[color:var(--primary,#1d5330)] px-4 py-2 text-xs font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
          onClick={onSave}
        >
          {t("courses.editor.saveNow")}
        </button>
        <button
          type="button"
          className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
          onClick={onCloseRequest}
        >
          {t("courses.editor.stopEditing")}
        </button>
      </div>
    </GlassCard>
  );
};

export default LessonSectionEditorPanel;
