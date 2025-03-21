import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import CourseList from "./CourseList";
import "../styles/scss/main.scss";

function CoursePage() {
  const { pathId } = useParams();
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/learningpaths/${pathId}/courses/`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
          }
        );
        setCourses(response.data);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      }
    };

    fetchCourses();
  }, [pathId]);

  return (
    <div className="course-page container-md pt-4">
      <h2>Courses</h2>
      <CourseList courses={courses} />
    </div>
  );
}

export default CoursePage;
