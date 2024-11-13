import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import CourseList from "./CourseList";

function CoursePage() {
  const { pathId } = useParams();
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    axios
      .get(`http://localhost:8000/api/learningpaths/${pathId}/courses/`)
      .then((response) => setCourses(response.data))
      .catch((error) => console.error("Failed to fetch courses:", error));
  }, [pathId]);

  return (
    <div className="course-page">
      <h2>Courses</h2>
      <CourseList courses={courses} />
    </div>
  );
}

export default CoursePage;
