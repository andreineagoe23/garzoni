import React from "react";
import DragAndDropExercise from "./DragAndDropExercise";
import styles from "../styles/InteractiveSection.css";

const InteractiveSection = ({ section, onComplete, isCompleted }) => {
  const getExerciseComponent = () => {
    if (!section.exercise_data) return null;

    switch (section.exercise_type) {
      case "drag-and-drop":
        return <DragAndDropExercise data={section.exercise_data} />;
      // Add cases for other exercise types here
      default:
        return <p>Unsupported exercise type</p>;
    }
  };

  return (
    <div className={styles.sectionWrapper}>
      {section.content_type === "text" && (
        <div dangerouslySetInnerHTML={{ __html: section.content }} />
      )}

      {section.content_type === "video" && (
        <div className={styles.videoWrapper}>
          <iframe
            src={section.video_url}
            title={section.title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {section.content_type === "exercise" && (
        <div className={styles.exerciseWrapper}>
          <h4>{section.title}</h4>
          {getExerciseComponent()}
          {!isCompleted && (
            <button onClick={onComplete}>Complete Exercise</button>
          )}
        </div>
      )}

      {isCompleted && <div className={styles.completionBadge}>✓ Completed</div>}
    </div>
  );
};

export default InteractiveSection;
