import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/monevo.png";
import { Button } from "react-bootstrap";

function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="app-container content-full">
      <div className="welcome-container">
        <div className="welcome-content">
          <img
            src={logo}
            alt="Monevo Logo"
            className="welcome-logo img-fluid"
          />

          <h1 className="welcome-heading">
            The free, fun, and effective way to learn about finance topics!
          </h1>

          <div className="d-grid gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate("/register")}
              className="btn-3d"
            >
              Get Started
            </Button>

            <Button
              variant="outline-primary"
              size="lg"
              onClick={() => navigate("/login")}
              className="btn-3d"
            >
              Already Signed Up?
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Welcome;
