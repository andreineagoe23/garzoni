// src/components/LearningPathList.js
import React from "react";
import { useNavigate } from "react-router-dom";

function LearningPathList({ learningPaths }) {
  const navigate = useNavigate();

  const handlePathClick = (pathId) => {
    navigate(`/courses/${pathId}`);
  };

  return (
    <div>
      <h3>Your Learning Paths</h3>
      <ul>
        {learningPaths.map((path) => (
          <li key={path.id} onClick={() => handlePathClick(path.id)}>
            {path.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LearningPathList;
