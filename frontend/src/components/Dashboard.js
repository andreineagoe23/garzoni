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

        setUser(profileResponse.data.user);
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
        <button className="button button--logout" onClick={handleLogout}>
          Logout
        </button>
        <h2>Hello, {user?.username || "User"}!</h2>

        <div className="dashboard-buttons">
          <button
            className={`button ${
              activePage === "all-topics" ? "button--primary" : ""
            }`}
            onClick={() => navigate("/all-topics")} // ✅ Updates the URL
          >
            All Topics
          </button>
          <button
            className={`button ${
              isQuestionnaireCompleted ? "button--premium" : "button--disabled"
            }`}
            onClick={() => {
              if (isQuestionnaireCompleted) {
                navigate("/personalized-path"); // ✅ Updates the URL
              } else {
                navigate("/questionnaire");
              }
            }}
          >
            Personalized Path
          </button>
        </div>

        {/* ✅ Renders the correct component based on URL */}
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
