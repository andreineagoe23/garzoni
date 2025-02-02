import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/monevo.png";
import "../styles/CustomStyles.css";
import "../styles/Welcome.css";

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <img src={logo} alt="Monevo Logo" className="welcome-logo" />

        <h1 className="welcome-heading">
          The free, fun, and effective way to learn about finance topics!
        </h1>

        <div className="d-grid gap-3">
          <button
            className="button button--primary button--large"
            onClick={() => navigate("/register")}
          >
            Get Started
          </button>

          <button
            className="button button--primary button--large"
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
