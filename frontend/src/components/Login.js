import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import axios from "axios";
import logo from "../assets/monevo.png";

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  }
});

function Login() {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get CSRF cookie automatically
        await api.get('/csrf/');
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError('Please enable third-party cookies and refresh');
      }
    };
    initializeAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      navigate('/dashboard');
    } catch (error) {
      setError('Invalid credentials');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="login__container">
      <img src={logo} alt="Logo" className="login__logo" />
      <h2 className="login__heading">Login to Your Account</h2>

      {error && (
        <Alert variant="danger">
          {error}
          <div className="mt-2">
            <strong>Browser Fix:</strong>
            <ol>
              <li>Open Chrome Settings</li>
              <li>Search for "Third-party cookies"</li>
              <li>Enable "Third-party cookies"</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </Alert>
      )}

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
