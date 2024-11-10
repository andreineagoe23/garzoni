// src/components/LessonPage.js
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function LessonPage() {
  const { courseId } = useParams();
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    axios
      .get(`http://localhost:8000/api/courses/${courseId}/lessons/`)
      .then((response) => setLessons(response.data))
      .catch((error) => console.error("Failed to fetch lessons:", error));
  }, [courseId]);

  return (
    <div>
      <h3>Lessons</h3>
      <ul>
        {lessons.map((lesson) => (
          <li key={lesson.id}>{lesson.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default LessonPage;
