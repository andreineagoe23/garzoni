import React, { useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import logo from "../assets/logo.png";
import "../styles/scss/main.scss";

export default function ResetPassword() {
  const { uidb64, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/password-reset-confirm/${uidb64}/${token}/`,
        { new_password: password, confirm_password: confirmPassword }
      );
      setMessage(response.data.message || "Password reset successful.");
      setError("");
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      console.error("Error details:", error.response);
      setError(error.response?.data?.message || "An error occurred.");
      setMessage("");
    }
  };

  return (
    <div className="reset-password-container">
      <img src={logo} alt="Logo" className="img-fluid logo" />
      <h2>Reset Password</h2>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={handleResetPassword}>
        <Form.Group className="mb-4" controlId="password">
          <Form.Label>New Password</Form.Label>
          <Form.Control
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mb-4" controlId="confirmPassword">
          <Form.Label>Confirm Password</Form.Label>
          <Form.Control
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </Form.Group>

        <div className="d-grid gap-3 mb-4">
          <Button
            variant="primary"
            size="lg"
            type="submit"
            className="btn-3d"
          >
            Reset Password
          </Button>
        </div>
      </Form>
    </div>
  );
}