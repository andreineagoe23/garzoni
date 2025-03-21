import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import logo from "../assets/monevo.png";

function Login() {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [userAuthenticated, setUserAuthenticated] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/login/`,
        formData
      );

      // Store tokens
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);

      await fetchUserData();
      setUserAuthenticated(true);
    } catch (error) {
      console.error("Login failed", error);
      setError("Invalid username or password");
    }
  };

  useEffect(() => {
    if (userAuthenticated) navigate("/all-topics");
  }, [userAuthenticated, navigate]);

  const fetchUserData = async () => {
    try {
      await axios.get(`${process.env.REACT_APP_BACKEND_URL}/userprofile/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        }
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
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
