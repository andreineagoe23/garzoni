import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import CourseList from "./CourseList";
import "../styles/scss/main.scss";

function CoursePage() {
  const { pathId } = useParams();
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    axios
      .get(
        `${process.env.REACT_APP_BACKEND_URL}/learningpaths/${pathId}/courses/`,
        { withCredentials: true }
      )
      .then((response) => setCourses(response.data))
      .catch((error) => console.error("Failed to fetch courses:", error));
  }, [pathId]);

  return (
    <div className="course-page container-md pt-4">
      <h2>Courses</h2>
      <CourseList courses={courses} />
    </div>
  );
}

export default CoursePage;