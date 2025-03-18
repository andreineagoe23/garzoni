import React from "react";
import "../styles/scss/main.scss";

function LearningPathList({
  learningPaths,
  onCourseClick,
  showCourseImages = true,
}) {
  return (
    <div className="learning-paths">
      {learningPaths.map((path) => (
        <div key={path.id} className="learning-path">
          <h3>{path.title || "Custom Path"}</h3>
          <div className="courses">
            {path.courses.map((course) => (
              <div
                key={course.id}
                className="course-card"
                onClick={() => onCourseClick(course.id)}
                role="button"
                tabIndex={0}
              >
                {showCourseImages && course.image && (
                  <img
                    src={course.image}
                    alt={course.title}
                    className="course-image"
                  />
                )}
                <div className="course-info">
                  <h4>{course.title}</h4>
                  <p>{course.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default LearningPathList;
