import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/monevo.png"; // Replace with your logo path
import "../styles/CustomStyles.css"; // Import reusable button styles
import "../styles/Welcome.css"; // Import page-specific styles

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        {/* Logo */}
        <img src={logo} alt="Monevo Logo" className="welcome-logo" />

        {/* Heading */}
        <h1 className="welcome-heading">
          The free, fun, and effective way to learn about finance topics!
        </h1>

        {/* Buttons */}
        <div className="d-grid gap-3">
          <button
            className="button button--primary button--large"
            onClick={() => navigate("/register")}
          >
            Get Started
          </button>

          <button
            className="button button--secondary button--large"
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
