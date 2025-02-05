import React, { useState, useEffect } from "react";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import "../styles/AllTopics.css";

function AllTopics({ onCourseClick, imageMap }) {
  const [learningPaths, setLearningPaths] = useState([]);
  const [activePathId, setActivePathId] = useState(null);

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/paths/`,
          {
            withCredentials: true,
          }
        );

        const updatedPaths = response.data.map((path) => ({
          ...path,
          image: imageMap[path.title] || null,
        }));

        setLearningPaths(updatedPaths);
      } catch (error) {
        console.error(
          "❌ Error fetching learning paths:",
          error.response?.data || error
        );
      }
    };

    fetchPaths();
  }, [imageMap]);

  const handleTogglePath = (pathId) => {
    setActivePathId((prevId) => (prevId === pathId ? null : pathId));
  };

  return (
    <div className="all-topics">
      <div className="learning-paths-container">
        {learningPaths.map((path) => (
          <div key={path.id} className="learning-path-card">
            <h3>{path.title}</h3>

            {path.image && (
              <img src={path.image} alt={path.title} className="path-image" />
            )}

            <p>{path.description}</p>
            <button
              className="button button--primary"
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
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AllTopics;
