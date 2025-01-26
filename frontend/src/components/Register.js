import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Register.css";
import "../styles/CustomStyles.css";
import logo from "../assets/monevo.png";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

function Register() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    first_name: "",
    last_name: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/api/register/`, formData);
      const loginResponse = await axios.post(`${API_BASE_URL}/api/token/`, {
        username: formData.username,
        password: formData.password,
      });

      localStorage.setItem("accessToken", loginResponse.data.access);
      localStorage.setItem("refreshToken", loginResponse.data.refresh);

      navigate("/dashboard");
    } catch (error) {
      console.error("Registration failed", error);
      setErrorMessage(
        error.response?.data?.detail || "An error occurred. Please try again."
      );
    }
  };

  return (
    <div className="register-container">
      <img src={logo} alt="Logo" className="logo" />
      <h2>Create Your Account</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      <form onSubmit={handleRegister}>
        <label>Username</label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
        />
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <label>Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <label>First Name</label>
        <input
          type="text"
          name="first_name"
          value={formData.first_name}
          onChange={handleChange}
          required
        />
        <label>Last Name</label>
        <input
          type="text"
          name="last_name"
          value={formData.last_name}
          onChange={handleChange}
          required
        />
        <button type="submit" className="button button--primary button--large">
          Register
        </button>
      </form>
    </div>
  );
}

export default Register;
