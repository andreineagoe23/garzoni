import React, { useEffect, useRef, useState } from "react";
import { GlassButton, GlassCard } from "components/ui";
import { useTheme } from "contexts/ThemeContext";

const RichTextEditor = ({ value, onChange }) => {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const lastEmittedDataRef = useRef(null);
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
        const ClassicEditor = (await import("@ckeditor/ckeditor5-build-classic"))
          .default;

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
        setLoadError("Failed to load editor.");
      }
    })();

    return () => {
      cancelled = true;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []); // initialize editor once; callback updates via onChangeRef

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
  currentSectionTitle,
}) => {
  const [previewMode, setPreviewMode] = useState(false);
  const [exerciseJson, setExerciseJson] = useState("{}");
  const [lastValidExerciseJson, setLastValidExerciseJson] = useState("{}");
  const [jsonError, setJsonError] = useState("");
  const activeSectionIdRef = useRef(null);
  const sectionExerciseDataRef = useRef(null);

  const getJsonErrorDetails = (value, error) => {
    const message = String(error?.message || "Invalid JSON.");
    const match = message.match(/position\s+(\d+)/i);
    const position = match ? Number(match[1]) : null;
    if (position == null || Number.isNaN(position)) {
      return { message: "Exercise configuration must be valid JSON." };
    }

    const before = value.slice(0, position);
    const line = before.split("\n").length;
    const lastNewline = before.lastIndexOf("\n");
    const column = position - (lastNewline === -1 ? 0 : lastNewline + 1) + 1;

    return {
      message: `Invalid JSON at line ${line}, column ${column}.`,
    };
  };

  useEffect(() => {
    sectionExerciseDataRef.current = section?.exercise_data ?? null;
  }, [section?.exercise_data]);

  useEffect(() => {
    setPreviewMode(false);
    setJsonError("");
    activeSectionIdRef.current = section?.id ?? null;
    const exerciseData = sectionExerciseDataRef.current;
    const nextJson = exerciseData ? JSON.stringify(exerciseData, null, 2) : "{}";
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
  }, [section?.exercise_data, section?.id, exerciseJson, lastValidExerciseJson, section]);

  const handleJsonChange = (value) => {
    setExerciseJson(value);
    try {
      const parsed = value ? JSON.parse(value) : {};
      onChange({ exercise_data: parsed });
      setJsonError("");
      setLastValidExerciseJson(value);
    } catch (err) {
      const details = getJsonErrorDetails(value, err);
      setJsonError(details.message);
    }
  };

  const handleContentTypeChange = (value) => {
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
          Select a section to begin editing or create a new section from the
          lesson view.
        </p>
        {currentSectionTitle && (
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            Current selection: {currentSectionTitle}
          </p>
        )}
        <GlassButton variant="ghost" size="sm" onClick={onCloseRequest}>
          Close editor
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
              Admin mode
            </p>
            <h3 className="text-lg font-semibold text-[color:var(--text-color,#111827)]">
              {section.title || "Untitled section"}
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
              {section.is_published ? "Published" : "Draft"}
            </span>
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode((prev) => !prev)}
            >
              {previewMode ? "Hide preview" : "Show preview"}
            </GlassButton>
            <GlassButton variant="primary" size="sm" onClick={onPublishToggle}>
              {section.is_published ? "Move to draft" : "Publish"}
            </GlassButton>
            <GlassButton variant="danger" size="sm" onClick={onDelete}>
              Delete
            </GlassButton>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-text,#6b7280)]">
          {savingState?.status === "saving" && <span>Autosaving changes…</span>}
          {savingState?.status === "saved" && <span>Changes saved</span>}
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
            Title
          </label>
          <input
            value={section.title || ""}
            onChange={(event) => onChange({ title: event.target.value })}
            className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            placeholder="Section title"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              Content type
            </label>
            <select
              value={section.content_type || "text"}
              onChange={(event) => handleContentTypeChange(event.target.value)}
              className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
            >
              <option value="text">Text</option>
              <option value="video">Video</option>
              <option value="exercise">Exercise</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
              Order
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
              Body
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
              Video URL
            </label>
            <input
              value={section.video_url || ""}
              onChange={(event) => onChange({ video_url: event.target.value })}
              className="w-full rounded-lg border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-3 py-2 text-sm text-[color:var(--text-color,#111827)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              placeholder="https://..."
            />
          </div>
        )}

        {section.content_type === "exercise" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                Exercise picker
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
                    ? "Loading exercises..."
                    : "Select an exercise"}
                </option>
                {exercises?.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.question || exercise.type}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[color:var(--muted-text,#6b7280)]">
                Exercise JSON
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
              Preview
            </p>
            <div
              className="prose max-w-none text-[color:var(--text-color,#111827)] dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: section.text_content }}
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
          Save now
        </button>
        <button
          type="button"
          className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
          onClick={onCloseRequest}
        >
          Stop editing
        </button>
      </div>
    </GlassCard>
  );
};

export default LessonSectionEditorPanel;
