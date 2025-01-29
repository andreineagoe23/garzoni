import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import LearningPathList from "./LearningPathList";
import UserProgressBox from "./UserProgressBox";
import "../styles/Dashboard.css";
import Chatbot from "./Chatbot";

// Import images
import BasicFinanceImage from "../assets/basicfinance.png";
import CryptoImage from "../assets/crypto.png";
import RealEstateImage from "../assets/realestate.png";
import ForexImage from "../assets/forex.png";
import PersonalFinanceImage from "../assets/personalfinance.png";
import MindsetImage from "../assets/mindset.png";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [learningPaths, setLearningPaths] = useState([]);
  const [personalizedPaths, setPersonalizedPaths] = useState([]);
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
        // Fetch user profile and check questionnaire completion
        const profileResponse = await axios.get(
          "http://localhost:8000/api/userprofile/",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        setUser(profileResponse.data.user);
        setIsQuestionnaireCompleted(
          profileResponse.data.is_questionnaire_completed
        ); // ✅ Now updating properly

        // Fetch all topics
        const pathsResponse = await axios.get(
          "http://localhost:8000/api/paths/",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        const fetchedPaths = pathsResponse.data.map((path) => {
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
            case "Personal Finance":
              image = PersonalFinanceImage;
              break;
            case "Financial Mindset":
              image = MindsetImage;
              break;
            default:
              image = null;
          }
          return { ...path, image };
        });

        setLearningPaths(fetchedPaths);

        // ✅ Fetch personalized paths only if questionnaire is completed
        if (profileResponse.data.is_questionnaire_completed) {
          const personalizedResponse = await axios.get(
            "http://localhost:8000/api/personalized-path/",
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          setPersonalizedPaths(personalizedResponse.data);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [activePage, navigate]);

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

  const renderPaths = (paths, isPersonalized = false) =>
    paths.map((path) => (
      <div key={path.id} className="learning-path-card">
        <h3>{isPersonalized ? `Recommended: ${path.title}` : path.title}</h3>
        <img src={path.image} alt={path.title} className="path-image" />
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
    ));

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="dashboard-container">
          <button onClick={handleLogout} className="button button--secondary">
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
                  ? "button--primary"
                  : "button--disabled"
              }`}
              onClick={() => {
                if (isQuestionnaireCompleted) {
                  navigate("/personalized-path");
                } else {
                  navigate("/questionnaire");
                }
              }}
            >
              {isQuestionnaireCompleted
                ? "Personalized Path"
                : "Unlock Personalized Path"}
            </button>
          </div>

          <div className="learning-paths-container">
            {activePage === "all-topics"
              ? renderPaths(learningPaths)
              : renderPaths(personalizedPaths)}
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
