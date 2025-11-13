import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "contexts/AuthContext";
import PageContainer from "components/common/PageContainer";
import CourseList from "./CourseList";
import { GlassCard } from "components/ui";

function CoursePage() {
  const { pathId } = useParams();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/learningpaths/${pathId}/courses/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setCourses(response.data);
        setError("");
      } catch (err) {
        console.error("Failed to fetch courses:", err);
        setError(
          "We couldn't load the courses for this path. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [pathId, getAccessToken]);

  return (
    <PageContainer maxWidth="5xl">
      <header className="space-y-2 text-center md:text-left">
        <h1 className="text-3xl font-bold text-[color:var(--accent,#111827)]">
          Courses
        </h1>
        <p className="text-sm text-[color:var(--muted-text,#6b7280)]">
          Explore the curated lessons inside this learning path.
        </p>
      </header>

      {loading ? (
        <GlassCard padding="md" className="flex items-center gap-3 bg-[color:var(--card-bg,#ffffff)]/60 text-[color:var(--muted-text,#6b7280)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          Loading courses...
        </GlassCard>
      ) : error ? (
        <GlassCard padding="md" className="border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 text-sm text-[color:var(--error,#dc2626)] shadow-[color:var(--error,#dc2626)]/10">
          {error}
        </GlassCard>
      ) : (
        <CourseList courses={courses} />
      )}
    </PageContainer>
  );
}

export default CoursePage;

