import React, { useEffect, useRef, useState } from "react";
import { GlassCard } from "components/ui";

const CKEDITOR_SRC = "https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js";

const loadEditor = () => {
  if (window.ClassicEditor) {
    return Promise.resolve(window.ClassicEditor);
  }

  if (window.__monevoCkeditorPromise) {
    return window.__monevoCkeditorPromise;
  }

  window.__monevoCkeditorPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CKEDITOR_SRC;
    script.onload = () => resolve(window.ClassicEditor);
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return window.__monevoCkeditorPromise;
};

const RichTextEditor = ({ value, onChange }) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    loadEditor()
      .then(() => {
        if (!containerRef.current || !isMounted) return null;

        return window.ClassicEditor.create(containerRef.current)
          .then((instance) => {
            if (!isMounted) return null;
            editorRef.current = instance;
            instance.setData(value || "");
            instance.model.document.on("change:data", () => {
              onChange(instance.getData());
            });
            return null;
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("CKEditor failed to initialize", err);
          });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("CKEditor failed to load", err);
      });

    return () => {
      isMounted = false;
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [onChange]);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getData()) {
      editorRef.current.setData(value || "");
    }
  }, [value]);

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] shadow-sm">
      <div ref={containerRef} />
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
  const [jsonError, setJsonError] = useState("");

  useEffect(() => {
    setPreviewMode(false);
    setJsonError("");
    setExerciseJson(section?.exercise_data ? JSON.stringify(section.exercise_data, null, 2) : "{}");
  }, [section?.id]);

  const handleJsonChange = (value) => {
    setExerciseJson(value);
    try {
      const parsed = value ? JSON.parse(value) : {};
      onChange({ exercise_data: parsed });
      setJsonError("");
    } catch (err) {
      setJsonError("Exercise configuration must be valid JSON.");
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
      <GlassCard padding="lg" className="h-full space-y-4">
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Select a section to begin editing or create a new section from the lesson view.
        </p>
        {currentSectionTitle && (
          <p className="text-xs text-[color:var(--muted-text,#6b7280)]">
            Current selection: {currentSectionTitle}
          </p>
        )}
        <button
          type="button"
          className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-4 py-2 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)] hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
          onClick={onCloseRequest}
        >
          Close editor
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="lg" className="h-full space-y-4">
      <header className="space-y-2">
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
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {section.is_published ? "Published" : "Draft"}
            </span>
            <button
              type="button"
              className="rounded-full border border-[color:var(--border-color,#d1d5db)] px-3 py-1 text-xs font-semibold text-[color:var(--muted-text,#6b7280)] transition hover:border-[color:var(--primary,#1d5330)]/60 hover:text-[color:var(--primary,#1d5330)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              onClick={() => setPreviewMode((prev) => !prev)}
            >
              {previewMode ? "Hide preview" : "Show preview"}
            </button>
            <button
              type="button"
              className="rounded-full border border-[color:var(--primary,#1d5330)] px-3 py-1 text-xs font-semibold text-[color:var(--primary,#1d5330)] transition hover:bg-[color:var(--primary,#1d5330)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              onClick={onPublishToggle}
            >
              {section.is_published ? "Move to draft" : "Publish"}
            </button>
            <button
              type="button"
              className="rounded-full border border-[color:var(--error,#dc2626)]/50 px-3 py-1 text-xs font-semibold text-[color:var(--error,#dc2626)] transition hover:bg-[color:var(--error,#dc2626)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--error,#dc2626)]/40"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-text,#6b7280)]">
          {savingState?.status === "saving" && <span>Autosaving changes…</span>}
          {savingState?.status === "saved" && <span>Changes saved</span>}
          {savingState?.status === "error" && (
            <span className="text-[color:var(--error,#dc2626)]">{savingState?.message}</span>
          )}
        </div>
      </header>

      <div className="space-y-4">
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
              onChange={(event) => onChange({ order: Number(event.target.value) })}
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
                  {loadingExercises ? "Loading exercises..." : "Select an exercise"}
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
                <p className="text-xs text-[color:var(--error,#dc2626)]">{jsonError}</p>
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

      <div className="flex flex-wrap items-center gap-2 pt-2">
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
