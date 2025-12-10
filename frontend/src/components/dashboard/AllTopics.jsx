import React, { useEffect, useState } from "react";
import axios from "axios";
import LearningPathList from "components/courses/LearningPathList";
import { useAuth } from "contexts/AuthContext";
import { GlassButton, GlassCard } from "components/ui";
import { BACKEND_URL } from "services/backendUrl";

const AllTopics = ({ onCourseClick }) => {
  const [learningPaths, setLearningPaths] = useState([]);
  const [activePathId, setActivePathId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${BACKEND_URL}/paths/`,
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

        const anchor = sessionStorage.getItem("scrollToPathId");
        if (anchor) {
          setTimeout(() => {
            const el = document.getElementById(anchor);
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
              el.classList.add("ring-2", "ring-[color:var(--accent,#2563eb)]");
              setActivePathId(anchor);
              setTimeout(
                () =>
                  el.classList.remove(
                    "ring-2",
                    "ring-[color:var(--accent,#2563eb)]"
                  ),
                2000
              );
            }
            sessionStorage.removeItem("scrollToPathId");
          }, 500);
        }
      } catch (err) {
        console.error("Error fetching learning paths:", err);
        setError("Failed to load learning paths. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPaths();
  }, [getAccessToken]);

  const handleTogglePath = (pathId) => {
    setActivePathId((prev) => (prev === pathId ? null : pathId));
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-color,#d1d5db)] bg-[color:var(--card-bg,#ffffff)] px-6 py-8 text-[color:var(--muted-text,#6b7280)] shadow-inner shadow-black/5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--accent,#2563eb)] border-t-transparent" />
          Loading learning paths...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[color:var(--error,#dc2626)]/40 bg-[color:var(--error,#dc2626)]/10 px-6 py-8 text-[color:var(--error,#dc2626)] shadow-inner shadow-[color:var(--error,#dc2626)]/10">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {learningPaths.map((path) => (
        <GlassCard key={path.id} id={path.id} className="group" padding="lg">
              <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--primary,#1d5330)]/3 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
          <div className="relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {path.image && (
                  <div className="hidden h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--border-color,rgba(0,0,0,0.1))] bg-[color:var(--input-bg,#f3f4f6)] shadow-md sm:block">
                    <img
                      src={path.image}
                      alt={path.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-semibold text-[color:var(--accent,#111827)]">
                    <span>{path.title}</span>
                  </h3>
                  {path.description && (
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-text,#6b7280)]">
                      {path.description}
                    </p>
                  )}
                </div>
              </div>

              <GlassButton
                variant={activePathId === path.id ? "primary" : "success"}
                onClick={() => handleTogglePath(path.id)}
                icon={activePathId === path.id ? "▼" : "▶"}
              >
                {activePathId === path.id ? "Hide Courses" : "View Courses"}
              </GlassButton>
            </div>

            {activePathId === path.id && (
              <div className="mt-6">
                <LearningPathList
                  learningPaths={[path]}
                  onCourseClick={onCourseClick}
                  showCourseImages={false}
                />
              </div>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  );
};

export default AllTopics;

