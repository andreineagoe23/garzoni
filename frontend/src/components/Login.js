import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import api from "../api"; // Import the custom axios instance
import logo from "../assets/monevo.png";

function Login() {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Use the api instance which automatically handles credentials
      await api.post("/login/", formData);

      // Redirect to dashboard after successful login
      navigate("/dashboard");
    } catch (error) {
      console.error("Login failed", error);
      setError(error.response?.data?.detail || "Invalid username or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check for existing session on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.get("/userprofile/");
        navigate("/dashboard");
      } catch (error) {
        // Not logged in, stay on login page
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="login__container">
      <img src={logo} alt="Logo" className="login__logo" />
      <h2 className="login__heading">Login to Your Account</h2>

      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={handleLogin}>
        <Form.Group className="mb-4">
          <Form.Label>Username</Form.Label>
          <Form.Control
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </Form.Group>

        <Form.Group className="mb-4">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={isSubmitting}
          />
        </Form.Group>

        <div className="d-grid gap-3 mb-4">
          <Button
            variant="primary"
            size="lg"
            type="submit"
            className="btn-3d"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </Button>
        </div>

        <div className="text-center">
          <Button
            variant="link"
            onClick={() => navigate("/forgot-password")}
            className="text-decoration-none"
          >
            Forgot Password?
          </Button>
        </div>
      </Form>
    </div>
  );
}

export default Login;
