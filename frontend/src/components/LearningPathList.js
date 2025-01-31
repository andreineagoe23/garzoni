import React from "react";
import "../styles/LearningPathList.css";

function LearningPathList({ learningPaths, onCourseClick }) {
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
              >
                {course.image && (
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
