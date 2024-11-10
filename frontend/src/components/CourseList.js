// src/components/CourseList.js
import React from "react";
import { useNavigate } from "react-router-dom";

function CourseList({ courses }) {
  const navigate = useNavigate();

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  return (
    <ul>
      {courses.map((course) => (
        <li key={course.id} onClick={() => handleCourseClick(course.id)}>
          {course.name}
        </li>
      ))}
    </ul>
  );
}

export default CourseList;
