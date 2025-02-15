import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/PersonalizedPath.css";
import { motion } from "framer-motion";

function PersonalizedPath({ onCourseClick }) {
  const [personalizedCourses, setPersonalizedCourses] = useState([]);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("📡 Fetching personalized courses...");

    const fetchPersonalizedPath = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/personalized-path/`,
          { withCredentials: true }
        );

        console.log("✅ API Response:", response.data);

        const courses = response.data?.personalized_courses || [];
        const message = response.data?.message || "";

        console.log("Fetched courses:", courses);
        console.log(
          "Image URLs:",
          courses.map((course) => course.image)
        );

        const updatedCourses = courses.map((course) => ({
          ...course,
          image: course.image,
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
  }, []);

  return (
    <div className="personalized-path">
      {isLoading ? (
        <p>Loading your personalized courses...</p>
      ) : (
        <>
          <p className="recommendation-message">{recommendationMessage}</p>

          <div className="path-container">
            {personalizedCourses.map((course, index) => (
              <React.Fragment key={course.id}>
                <div
                  className={`path-item ${index % 2 === 0 ? "left" : "right"}`}
                >
                  <div className="course-node">
                    <div className="course-circle">
                      {course.image && (
                        <img
                          src={course.image}
                          alt={course.title}
                          className="course-image"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      )}
                    </div>
                    <div className="horizontal-connector"></div>
                  </div>

                  <motion.div
                    className="course-box"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onCourseClick(course.id)}
                  >
                    <h4>{course.title}</h4>
                    <p className="course-progress">
                      {course.completed_lessons || 0}/
                      {course.total_lessons || 0} Lessons
                    </p>
                  </motion.div>
                </div>

                {index < personalizedCourses.length - 1 && (
                  <div className="vertical-connector"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PersonalizedPath;
