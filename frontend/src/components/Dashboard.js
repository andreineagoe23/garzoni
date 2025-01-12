import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import UserProgressBox from "./UserProgressBox";
import "../styles/Dashboard.css";
import Chatbot from "./Chatbot";

// Import images from src/assets
import BasicFinanceImage from "../assets/basicfinance.png";
import CryptoImage from "../assets/crypto.png";
import RealEstateImage from "../assets/realestate.png";
import ForexImage from "../assets/forex.png";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [learningPaths, setLearningPaths] = useState([
    {
      id: 1,
      title: "Basic Finance",
      description:
        "Learn the essentials of budgeting, saving, and financial planning.",
      image: BasicFinanceImage,
    },
    {
      id: 2,
      title: "Crypto",
      description: "Explore cryptocurrency, blockchain, and digital assets.",
      image: CryptoImage,
    },
    {
      id: 3,
      title: "Real Estate",
      description: "Understand real estate investment and property management.",
      image: RealEstateImage,
    },
    {
      id: 4,
      title: "Forex",
      description: "Dive into foreign exchange markets and currency trading.",
      image: ForexImage,
    },
  ]);
  const [recommendedPath, setRecommendedPath] = useState(null);
  const [showRecommendation, setShowRecommendation] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      navigate("/login");
    } else {
      // Fetch user info
      axios
        .get("http://localhost:8000/api/userprofile/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => setUser(response.data))
        .catch((error) => console.error("Failed to fetch user data:", error));

      // Fetch learning paths
      axios
        .get("http://localhost:8000/api/paths/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          const fetchedPaths = response.data;

          // Merge images with fetched paths
          const pathsWithImages = fetchedPaths.map((path) => {
            let image;
            switch (path.title) {
              case "Basic Finance":
                image = BasicFinanceImage;
                break;
              case "Crypto":
                image = CryptoImage;
                break;
              case "Real Estate":
                image = RealEstateImage;
                break;
              case "Forex":
                image = ForexImage;
                break;
              default:
                image = null; // Fallback if no matching title
            }
            return { ...path, image };
          });

          setLearningPaths(pathsWithImages);
        })
        .catch((error) =>
          console.error("Failed to fetch learning paths:", error)
        );

      // Fetch questionnaire
      axios
        .get("http://localhost:8000/api/questionnaire/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          const userProfile = response.data;

          if (userProfile.is_questionnaire_completed) {
            return;
          }

          axios
            .get("http://localhost:8000/api/questionnaire/", {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
            .then((response) => {
              const { goal, experience, preferred_style } = response.data;

              if (goal === "Save and budget effectively") {
                setRecommendedPath("Basic Finance");
              } else if (
                goal === "Start investing" &&
                experience === "Beginner"
              ) {
                setRecommendedPath("Basic Finance");
              } else if (goal === "Achieve financial independence") {
                setRecommendedPath("Real Estate");
              } else if (preferred_style === "Interactive and hands-on") {
                setRecommendedPath("Crypto");
              } else if (experience === "Advanced") {
                setRecommendedPath("Forex");
              } else {
                setRecommendedPath("General Financial Literacy");
              }

              setTimeout(() => setShowRecommendation(false), 10000);
            })
            .catch((error) =>
              console.error("Failed to fetch questionnaire data:", error)
            );
        })
        .catch((error) =>
          console.error("Failed to fetch user profile:", error)
        );
    }
  }, [navigate]);

  const togglePath = (pathId) => {
    setLearningPaths((prevPaths) =>
      prevPaths.map((path) =>
        path.id === pathId
          ? { ...path, isExpanded: !path.isExpanded }
          : { ...path, isExpanded: false }
      )
    );
  };

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/welcome");
  };

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="dashboard-container">
          <div className="main-section">
            <button onClick={handleLogout} className="button button--secondary">
              Logout
            </button>
            {user ? <h2>Hello, {user.username}!</h2> : <h2>Loading...</h2>}

            {showRecommendation && recommendedPath && (
              <p className="recommendation-message">
                Based on your answers, we recommend starting with:{" "}
                <strong>{recommendedPath}</strong>
              </p>
            )}

            <div className="learning-paths-container">
              {learningPaths.map((path) => (
                <div key={path.id} className="learning-path-card">
                  <h3>{path.title}</h3>
                  <img
                    src={path.image}
                    alt={path.title}
                    className="path-image"
                  />
                  <p>{path.description}</p>
                  <button
                    className="button button--primary"
                    onClick={() => togglePath(path.id)}
                  >
                    View Courses
                  </button>
                  {path.isExpanded && (
                    <LearningPathList
                      learningPaths={[path]}
                      activePathId={path.id}
                      onTogglePath={togglePath}
                      onCourseClick={handleCourseClick}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="user-progress">
        <UserProgressBox />
      </div>

      <Chatbot />
    </div>
  );
}

export default Dashboard;
