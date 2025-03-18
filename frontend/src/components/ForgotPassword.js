import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import logo from "../assets/monevo.png";
import "../styles/scss/main.scss";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/password-reset/`,
        { email }
      );
      setMessage(response.data.message);
      setError("");
    } catch (error) {
      console.error("Forgot Password Error:", error);
      setError(error.response?.data?.error || "An error occurred.");
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <img src={logo} alt="Logo" className="img-fluid logo" />
      <h2 className="login-heading">Forgot Password</h2>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={handleForgotPassword}>
        <Form.Group className="mb-4" controlId="email">
          <Form.Label>Email Address</Form.Label>
          <Form.Control
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </Form.Group>

        <div className="d-grid gap-3 mb-4">
          <Button
            variant="primary"
            size="lg"
            type="submit"
            className="btn-3d"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
        </div>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate("/login")}
            className="text-decoration-none"
          >
            Back to Login
          </Button>
        </div>
      </Form>
    </div>
  );
}

export default ForgotPassword;
