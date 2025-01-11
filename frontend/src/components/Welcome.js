import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/monevo.png"; // Ensure the logo image exists
import "../styles/Welcome.css";

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        {/* Logo */}
        <img src={logo} alt="Monevo Logo" className="welcome-logo" />

        {/* Main Heading */}
        <h1 className="welcome-heading">
          The free, fun, and effective way to learn about finance topics!
        </h1>

        {/* Action Buttons */}
        <div className="button-group">
          <button
            className="btn-primary welcome-btn"
            onClick={() => navigate("/register")}
          >
            Get Started
          </button>
          <button
            className="btn-primary-alt welcome-btn"
            onClick={() => navigate("/login")}
          >
            Already Have an Account?
          </button>
        </div>
      </div>
    </div>
  );
}

export default Welcome;
