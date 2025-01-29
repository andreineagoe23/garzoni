import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import UserProgressBox from "./UserProgressBox";
import Chatbot from "./Chatbot";
import "../styles/Dashboard.css";
import "../styles/PersonalizedPath.css";

// Import images
import BasicFinanceImage from "../assets/basicfinance.png";
import CryptoImage from "../assets/crypto.png";
import RealEstateImage from "../assets/realestate.png";
import ForexImage from "../assets/forex.png";
import PersonalFinanceImage from "../assets/personalfinance.png";
import MindsetImage from "../assets/mindset.png";

const imageMap = {
  "Basic Finance": BasicFinanceImage,
  Crypto: CryptoImage,
  "Real Estate": RealEstateImage,
  Forex: ForexImage,
  "Personal Finance": PersonalFinanceImage,
  "Financial Mindset": MindsetImage,
};

function Dashboard() {
  const [user, setUser] = useState(null);
  const [learningPaths, setLearningPaths] = useState([]);
  const [personalizedPaths, setPersonalizedPaths] = useState([]);
  const [recommendationMessage, setRecommendationMessage] = useState("");
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] =
    useState(false);
  const [activePage, setActivePage] = useState("all-topics");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        navigate("/login");
        return;
      }

      try {
        const profileResponse = await axios.get(
          "http://localhost:8000/api/userprofile/",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        setUser(profileResponse.data.user);
        setIsQuestionnaireCompleted(
          profileResponse.data.is_questionnaire_completed
        );

        const pathsResponse = await axios.get(
          "http://localhost:8000/api/paths/",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        const fetchedPaths = pathsResponse.data.map((path) => ({
          ...path,
          image: imageMap[path.title] || null,
          isExpanded: false,
        }));

        setLearningPaths(fetchedPaths);

        if (profileResponse.data.is_questionnaire_completed) {
          const personalizedResponse = await axios.get(
            "http://localhost:8000/api/personalized-path/",
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          const sortedPaths = personalizedResponse.data.recommended_paths.map(
            (path) => ({
              ...path,
              image: imageMap[path.title] || null,
              isExpanded: false,
            })
          );

          setPersonalizedPaths(sortedPaths);
          setRecommendationMessage(
            personalizedResponse.data.recommendation_message
          );
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  const togglePath = (pathId) => {
    setLearningPaths((prevPaths) =>
      prevPaths.map((path) =>
        path.id === pathId
          ? { ...path, isExpanded: !path.isExpanded }
          : { ...path, isExpanded: false }
      )
    );

    setPersonalizedPaths((prevPaths) =>
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

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="dashboard-container">
          <button className="button button--logout" onClick={handleLogout}>
            Logout
          </button>
          <h2>Hello, {user?.username || "User"}!</h2>

          <div className="dashboard-buttons">
            <button
              className={`button ${
                activePage === "all-topics" ? "button--primary" : ""
              }`}
              onClick={() => {
                setActivePage("all-topics");
                navigate("/all-topics");
              }}
            >
              All Topics
            </button>

            <button
              className={`button ${
                isQuestionnaireCompleted
                  ? "button--premium"
                  : "button--disabled"
              }`}
              onClick={() => {
                if (isQuestionnaireCompleted) {
                  setActivePage("personalized-path");
                  navigate("/personalized-path");
                } else {
                  navigate("/questionnaire");
                }
              }}
            >
              {isQuestionnaireCompleted
                ? "Personalized Path"
                : "Personalized Path"}
            </button>
          </div>

          {activePage === "personalized-path" && recommendationMessage && (
            <div className="recommendation-message">
              <p>{recommendationMessage}</p>
            </div>
          )}

          <div className="learning-paths-container">
            {activePage === "all-topics"
              ? learningPaths.map((path) => (
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
                      {path.isExpanded ? "Hide Courses" : "View Courses"}
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
                ))
              : personalizedPaths.map((path) => (
                  <div key={path.id} className="premium-path-card">
                    <h3 className="premium-title">{path.title}</h3>
                    <img
                      src={path.image}
                      alt={path.title}
                      className="premium-path-image"
                    />
                    <p className="premium-description">{path.description}</p>
                    <button
                      className="button button--premium"
                      onClick={() => togglePath(path.id)}
                    >
                      {path.isExpanded ? "Hide Courses" : "View Courses"}
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
      <div className="user-progress">
        <UserProgressBox />
      </div>
      <Chatbot />
    </div>
  );
}

export default Dashboard;
