import React from "react";
import DragAndDropExercise from "components/exercises/DragAndDropExercise";

const InteractiveSection = ({ section, onComplete, isCompleted }) => {
  const getExerciseComponent = () => {
    if (!section.exercise_data) return null;

    switch (section.exercise_type) {
      case "drag-and-drop":
        return <DragAndDropExercise data={section.exercise_data} />;
      default:
        return (
          <p className="rounded-xl border border-amber-300/60 bg-amber-100/20 px-4 py-3 text-sm text-amber-600" role="alert">
            Unsupported exercise type
          </p>
        );
    }
  };

  return (
    <section
      className="space-y-6 rounded-3xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)]/95 px-6 py-8 shadow-xl shadow-[color:var(--shadow-color,rgba(0,0,0,0.1))] backdrop-blur-lg transition-colors sm:px-8"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      aria-labelledby={`section-${section.id}-title`}
    >
      {section.content_type === "text" && (
        <article
          id={`section-${section.id}-title`}
          className="prose max-w-none text-[color:var(--text-color,#111827)] prose-headings:text-[color:var(--text-color,#111827)] prose-p:leading-relaxed prose-strong:text-[color:var(--primary,#1d5330)] dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: section.content }}
          aria-label="Text content section"
        />
      )}

      {section.content_type === "video" && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-black/10 shadow-inner">
            <div className="aspect-video">
              <iframe
                src={section.video_url}
                title={section.title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                aria-label="Educational video player"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {section.content_type === "exercise" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
                  <h4
                id={`section-${section.id}-title`}
                className="text-lg font-semibold text-[color:var(--text-color,#111827)]"
              >
                {section.title}
              </h4>
            {isCompleted && (
              <span
                role="status"
                aria-label="Section completed"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-500"
              >
                ✓ Completed
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--input-bg,#f8fafc)] p-4 shadow-inner shadow-[color:var(--shadow-color,rgba(0,0,0,0.05))]">
            {getExerciseComponent()}
          </div>

          {!isCompleted && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary,#1d5330)] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-[color:var(--primary,#1d5330)]/30 transition hover:shadow-lg hover:shadow-[color:var(--primary,#1d5330)]/40 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#1d5330)]/40"
              onClick={onComplete}
              aria-label={`Complete ${section.title} exercise`}
            >
              Complete Exercise
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default InteractiveSection;
