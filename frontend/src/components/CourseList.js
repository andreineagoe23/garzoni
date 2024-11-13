import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CourseList.css"; // Import the corresponding CSS file for styling

function CourseList({ courses }) {
  const navigate = useNavigate();

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  return (
    <ul className="course-list">
      {courses.map((course) => (
        <li
          key={course.id}
          onClick={() => handleCourseClick(course.id)}
          className="course-item"
        >
          {course.title}
        </li>
      ))}
    </ul>
  );
}

export default CourseList;
