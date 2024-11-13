import React from "react";
import "../styles/LearningPathList.css"; // Import the corresponding CSS file if you have it

function LearningPathList({
  learningPaths,
  activePathId,
  onTogglePath,
  onCourseClick,
}) {
  return (
    <div className="learning-paths">
      {learningPaths.map((path) => (
        <div
          key={path.id}
          className={`learning-path ${
            activePathId === path.id ? "active" : ""
          }`}
        >
          <h3 onClick={() => onTogglePath(path.id)}>{path.title}</h3>
          {activePathId === path.id && (
            <ul>
              {path.courses.map((course) => (
                <li key={course.id} onClick={() => onCourseClick(course.id)}>
                  {course.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default LearningPathList;
