import React, { useState, useEffect } from "react";
import axios from "axios";
import { Container, Row, Col } from "react-bootstrap";
import LearningPathList from "./LearningPathList";
import "../styles/scss/main.scss";
import { useAuth } from "./AuthContext";

const AllTopics = ({ onCourseClick }) => {
  const [learningPaths, setLearningPaths] = useState([]);
  const [activePathId, setActivePathId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

        // Scroll to anchor if present in sessionStorage
        const anchor = sessionStorage.getItem("scrollToPathId");
        if (anchor) {
          setTimeout(() => {
            const el = document.getElementById(anchor);
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
              el.classList.add("highlight-path");
              // Automatically show courses for this path
              setActivePathId(anchor);
              // Remove highlight after animation
              setTimeout(() => el.classList.remove("highlight-path"), 2000);
            }
            sessionStorage.removeItem("scrollToPathId");
          }, 500);
        }
      } catch (error) {
        console.error("Error fetching learning paths:", error);
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
      <div className="page-content">
        <Container>
          <div className="loading-container">
            <div className="spinner-border text-accent" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p>Loading learning paths...</p>
          </div>
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <Container>
          <div className="error-container">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="page-content">
      <Container>
        <div className="page-header">
          <h1 className="page-header-title">Learning Paths</h1>
        </div>

        <Row className="learning-paths-container">
          {learningPaths.map((path) => (
            <Col key={path.id} xs={12} md={12} lg={6} className="mb-4">
              <div
                id={path.id}
                className={`learning-path-card card h-100 ${
                  activePathId === path.id ? "active-path" : ""
                }`}
              >
                <div className="card-inner">
                  {path.image && (
                    <img
                      src={path.image}
                      alt={path.title}
                      className="path-image img-fluid rounded"
                    />
                  )}
                  <div className="card-body">
                    <h3 className="card-title mb-3">{path.title}</h3>
                    <p>{path.description}</p>
                    <button
                      className="btn btn-outline-primary w-100"
                      onClick={() => handleTogglePath(path.id)}
                    >
                      {activePathId === path.id
                        ? "Hide Courses"
                        : "View Courses"}
                    </button>
                    {activePathId === path.id && (
                      <div className="courses-list mt-3">
                        <LearningPathList
                          learningPaths={[path]}
                          activePathId={path.id}
                          onTogglePath={handleTogglePath}
                          onCourseClick={onCourseClick}
                          showCourseImages={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </div>
  );
};

export default AllTopics;
