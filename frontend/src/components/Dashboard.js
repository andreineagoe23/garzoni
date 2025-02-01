import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import AllTopics from "./AllTopics";
import PersonalizedPath from "./PersonalizedPath";
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
  const [isQuestionnaireCompleted, setIsQuestionnaireCompleted] =
    useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Set active tab based on the URL
  const activePage = location.pathname.includes("personalized-path")
    ? "personalized-path"
    : "all-topics";

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
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        setUser(profileResponse.data.user_data);
        setIsQuestionnaireCompleted(
          profileResponse.data.is_questionnaire_completed
        );
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleCourseClick = (courseId) => {
    navigate(`/lessons/${courseId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login");
  };

  return (
    <div className="dashboard">
      <div className="main-content">
        {/* ==== Dashboard Header Section ==== */}
        <div className="dashboard-header">
          <h2 className="dashboard-greeting">
            Welcome back, {user?.username || "User"}!
          </h2>
          <button className="button button--logout" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* ==== Button Row for "All Topics" & "Personalized Path" ==== */}
        <div className="dashboard-buttons">
          <button
            className={`button button--nav ${
              activePage === "all-topics" ? "button--active" : ""
            }`}
            onClick={() => navigate("/all-topics")}
          >
            All Topics
          </button>

          <button
            className={`button button--nav ${
              isQuestionnaireCompleted ? "" : "button--disabled"
            } ${activePage === "personalized-path" ? "button--active" : ""}`}
            onClick={() => {
              if (isQuestionnaireCompleted) {
                navigate("/personalized-path");
              } else {
                navigate("/questionnaire");
              }
            }}
          >
            Personalized Path
          </button>
        </div>

        {/* ==== Render the correct component based on URL ==== */}
        {activePage === "all-topics" ? (
          <AllTopics onCourseClick={handleCourseClick} imageMap={imageMap} />
        ) : (
          <PersonalizedPath
            onCourseClick={handleCourseClick}
            imageMap={imageMap}
          />
        )}
      </div>

      <div className="user-progress">
        <UserProgressBox />
      </div>

      <Chatbot />
    </div>
  );
}

export default Dashboard;
