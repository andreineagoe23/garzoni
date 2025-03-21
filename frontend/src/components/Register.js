import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert } from "react-bootstrap";
import logo from "../assets/monevo.png";

function Register() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    first_name: "",
    last_name: "",
    wants_personalized_path: false,
    referral_code: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRadioChange = (e) => {
    setFormData({
      ...formData,
      wants_personalized_path: e.target.value === "true",
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // Get CSRF token first
      const csrfResponse = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/csrf/`,
        { withCredentials: true }
      );

      // Perform registration
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/register/`,
        formData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfResponse.data.csrfToken,
          },
        }
      );

      if (/Mobi|Android/i.test(navigator.userAgent)) {
        window.location.href = response.data.next;
      } else {
        navigate(response.data.next);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="register-container">
      <img src={logo} alt="Logo" className="img-fluid logo" />
      <h2 className="register-heading">Create Your Account</h2>

      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

      <Form onSubmit={handleRegister}>
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
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={formData.email}
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

        <div className="row g-4 mb-4">
          <Form.Group className="col-md-6">
            <Form.Label>First Name</Form.Label>
            <Form.Control
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="col-md-6">
            <Form.Label>Last Name</Form.Label>
            <Form.Control
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </Form.Group>
        </div>

        <Form.Group className="mb-4">
          <Form.Label>Referral Code (optional)</Form.Label>
          <Form.Control
            type="text"
            name="referral_code"
            value={formData.referral_code}
            onChange={handleChange}
          />
        </Form.Group>

        <Form.Group className="mb-4">
          <Form.Label>Personalized Learning Path?</Form.Label>
          <div className="radio-group">
            <Form.Check
              type="radio"
              label="Yes"
              name="wants_personalized_path"
              value="true"
              checked={formData.wants_personalized_path === true}
              onChange={handleRadioChange}
              inline
            />
            <Form.Check
              type="radio"
              label="No"
              name="wants_personalized_path"
              value="false"
              checked={formData.wants_personalized_path === false}
              onChange={handleRadioChange}
              inline
            />
          </div>
        </Form.Group>

        <div className="d-grid gap-3">
          <Button variant="primary" size="lg" type="submit" className="btn-3d">
            Register
          </Button>
        </div>
      </Form>
    </div>
  );
}

export default Register;
