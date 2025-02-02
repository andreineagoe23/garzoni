import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/PersonalizedPath.css";
import { motion } from "framer-motion";

function PersonalizedPath({ onCourseClick, imageMap }) {
  const [personalizedCourses, setPersonalizedCourses] = useState([]);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("📡 Fetching personalized courses...");
    const accessToken = localStorage.getItem("accessToken");

    const fetchPersonalizedPath = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/personalized-path/`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const courses = response.data?.personalized_courses || [];
        const message = response.data?.message || "";

        console.log("✅ Fetched courses:", courses.length);

        const updatedCourses = courses.map((course) => ({
          ...course,
          image: imageMap[course.title] || null,
        }));

        setPersonalizedCourses(updatedCourses);
        setRecommendationMessage(message);
      } catch (error) {
        console.error("❌ Error fetching personalized path:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonalizedPath();
  }, [imageMap]);

  return (
    <div className="personalized-path">
      {isLoading ? (
        <p>Loading your personalized courses...</p>
      ) : (
        <>
          <p className="recommendation-message">{recommendationMessage}</p>

          <div className="path-container">
            {personalizedCourses.map((course, index) => (
              <div
                key={course.id}
                className={`path-item ${index % 2 === 0 ? "left" : "right"}`}
              >
                <motion.div
                  className="course-box"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
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
                </motion.div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PersonalizedPath;
