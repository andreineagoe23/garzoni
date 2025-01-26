import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import CourseList from "./CourseList";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function CoursePage() {
  const { pathId } = useParams();
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/learningpaths/${pathId}/courses/`)
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
