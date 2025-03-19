import React from "react";
import DragAndDropExercise from "./DragAndDropExercise";
import "../styles/main.scss";

const InteractiveSection = ({ section, onComplete, isCompleted }) => {
  const getExerciseComponent = () => {
    if (!section.exercise_data) return null;

    switch (section.exercise_type) {
      case "drag-and-drop":
        return <DragAndDropExercise data={section.exercise_data} />;
      default:
        return (
          <p className="text-muted" role="alert">
            Unsupported exercise type
          </p>
        );
    }
  };

  return (
    <section 
      className="interactive-section"
      aria-labelledby={`section-${section.id}-title`}
    >
      {section.content_type === "text" && (
        <article 
          className="content-text"
          dangerouslySetInnerHTML={{ __html: section.content }}
          aria-label="Text content section"
        />
      )}

      {section.content_type === "video" && (
        <div className="video-wrapper">
          <div className="ratio ratio-16x9">
            <iframe
              src={section.video_url}
              title={section.title}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              aria-label="Educational video player"
            />
          </div>
        </div>
      )}

      {section.content_type === "exercise" && (
        <div className="exercise-wrapper">
          <h4 id={`section-${section.id}-title`}>
            {section.title}
          </h4>
          {getExerciseComponent()}
          {!isCompleted && (
            <button 
              className="btn-accent"
              onClick={onComplete}
              aria-label={`Complete ${section.title} exercise`}
            >
              Complete Exercise
            </button>
          )}
        </div>
      )}

      {isCompleted && (
        <div 
          className="completion-badge"
          role="status"
          aria-label="Section completed"
        >
          ✓ Completed
        </div>
      )}
    </section>
  );
};

export default InteractiveSection;