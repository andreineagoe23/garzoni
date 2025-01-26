import React from "react";
import "../styles/LearningPathList.css";

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
            <div className="courses">
              {path.courses && Array.isArray(path.courses) ? (
                path.courses.map((course) => (
                  <div
                    key={course.id}
                    className="course-card"
                    onClick={() => onCourseClick(course.id)}
                  >
                    <div className="course-info">
                      <h4>{course.title}</h4>
                      <p>{course.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p>No courses available for this path.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default LearningPathList;
