import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function LessonPage() {
  const { courseId } = useParams();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLessons = async () => {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) {
        setError("You are not logged in. Please log in to view lessons.");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          `http://localhost:8000/api/lessons/?course=${courseId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        setLessons(response.data);
      } catch (err) {
        console.error("Failed to fetch lessons:", err);
        setError("Failed to load lessons. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [courseId]);

  if (loading) {
    return <p>Loading lessons...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div>
      <h3>Lessons</h3>
      <ul>
        {lessons.length > 0 ? (
          lessons.map((lesson) => (
            <li key={lesson.id}>
              <h4>{lesson.title}</h4>
              <p>{lesson.short_description}</p>
            </li>
          ))
        ) : (
          <p>No lessons available for this course.</p>
        )}
      </ul>
    </div>
  );
}

export default LessonPage;
