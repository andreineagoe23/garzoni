import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import axios from "axios";
import logo from "../assets/monevo.png";

// Create axios instance with default credentials
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function Login() {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const navigate = useNavigate();

  // Get CSRF token on component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await api.get("/csrf/");
        setCsrfToken(response.data.csrfToken);
      } catch (error) {
        console.error("Error fetching CSRF token:", error);
      }
    };
    fetchCsrfToken();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Login request
      const response = await api.post("/login/", formData, {
        headers: {
          "X-CSRFToken": csrfToken,
        },
      });

      console.log("Login response headers:", response.headers);

      await api.get("/userprofile/");
      
      navigate("/all-topics");
    } catch (error) {
      console.error("Login failed", error);
      setError(
        error.response?.data?.error ||
          "Login failed. Please check your credentials."
      );
      
      // Clear form on error
      setFormData({ username: "", password: "" });
    }
  };

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
            autoComplete="username"
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
            autoComplete="current-password"
          />
        </Form.Group>

        <div className="d-grid gap-3 mb-4">
          <Button variant="primary" size="lg" type="submit" className="btn-3d">
            Login
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