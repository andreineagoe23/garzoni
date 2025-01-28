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
  const navigate = useNavigate();

  // Fetch user info and learning paths
  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      navigate("/login");
    } else {
      axios
        .get("http://localhost:8000/api/userprofile/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => setUser(response.data))
        .catch((error) => console.error("Failed to fetch user data:", error));

      axios
        .get("http://localhost:8000/api/paths/", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          const fetchedPaths = response.data;

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
                image = null;
            }
            return { ...path, image };
          });

          setLearningPaths(pathsWithImages);
        })
        .catch((error) =>
          console.error("Failed to fetch learning paths:", error)
        );
    }
  }, [navigate]);

  // Fetch recommendation after user data is loaded
  useEffect(() => {
    if (user?.id) {
      const accessToken = localStorage.getItem("accessToken");

      axios
        .get(`http://localhost:8000/recommendation/${user.id}/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          console.log("Recommendation Data:", response.data);
          setRecommendedPath(response.data.path);
        })
        .catch((error) =>
          console.error("Failed to fetch recommendation data:", error)
        );
    }
  }, [user]);

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

            {recommendedPath ? (
              <div className="recommendation-message">
                <p>Based on your answers, we recommend starting with:</p>
                <h3>{recommendedPath}</h3>
              </div>
            ) : (
              <div className="recommendation-message">
                <p>
                  We couldn't determine a recommendation. Explore our learning
                  paths to get started!
                </p>
              </div>
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
