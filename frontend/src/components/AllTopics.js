import React, { useState, useEffect } from "react";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";

function AllTopics({ onCourseClick }) {
  const [learningPaths, setLearningPaths] = useState([]);
  const [activePathId, setActivePathId] = useState(null);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/paths/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        setLearningPaths(
          response.data.map((path) => ({
            ...path,
            image: path.image || null,
          }))
        );
      } catch (error) {
        console.error(
          "Error fetching learning paths:",
          error.response?.data || error
        );
      }
    };

    fetchPaths();
  }, [getAccessToken]);

  const handleTogglePath = (pathId) => {
    setActivePathId((prev) => (prev === pathId ? null : pathId));
  };

  return (
    <div className="all-topics container py-4">
      <div className="row g-4">
        {learningPaths.map((path) => (
          <div key={path.id} className="col-12 col-md-6">
            <div className="learning-path-card card h-100 shadow-sm">
              <div className="card-body">
                <h3 className="card-title mb-3">{path.title}</h3>

                {path.image && (
                  <img
                    src={path.image}
                    alt={path.title}
                    className="path-image img-fluid rounded mb-3"
                  />
                )}

                <p>{path.description}</p>

                <button
                  className="btn btn-outline-primary w-100"
                  onClick={() => handleTogglePath(path.id)}
                >
                  {activePathId === path.id ? "Hide Courses" : "View Courses"}
                </button>

                {activePathId === path.id && (
                  <LearningPathList
                    learningPaths={[path]}
                    activePathId={path.id}
                    onTogglePath={handleTogglePath}
                    onCourseClick={onCourseClick}
                    showCourseImages={false}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AllTopics;
