import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import "../styles/CustomStyles.css";
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
      console.log("🔵 Sending login request with data:", formData);

      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/login/`,
        formData,
        {
          withCredentials: true, // Ensure cookies are sent/received
        }
      );

      console.log("✅ Login successful, now fetching user data...");

      await fetchUserData(); // Fetch user profile to confirm authentication

      setUserAuthenticated(true); // ✅ Update state to trigger navigation
    } catch (error) {
      console.error("❌ Login failed", error);
      setError("Invalid username or password");
    }
  };

  useEffect(() => {
    if (userAuthenticated) {
      console.log("🚀 Redirecting to /all-topics...");
      navigate("/all-topics"); // ✅ Ensure navigation happens after authentication
    }
  }, [userAuthenticated, navigate]); // ✅ Only run when `userAuthenticated` changes

  const fetchUserData = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/userprofile/`,
        {
          withCredentials: true,
        }
      );
      console.log("User authenticated:", response.data);
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  return (
    <div className="login-container">
      <img src={logo} alt="Logo" className="logo" />
      <h2>Login to Your Account</h2>

      <form onSubmit={handleLogin}>
        <label>Username</label>
        <input
          type="text"
          name="username"
          value={formData.username}
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

        {error && <p className="error-message">{error}</p>}

        <div className="form-button-row">
          <button
            type="submit"
            className="button button--primary button--large"
          >
            Login
          </button>
        </div>
      </form>

      <div className="forgot-password">
        <button
          className="button button--secondary button--small"
          onClick={() => navigate("/forgot-password")}
        >
          Forgot Password?
        </button>
      </div>
    </div>
  );
}

export default Login;
