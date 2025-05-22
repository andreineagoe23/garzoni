import React, { useState, useEffect } from "react";
// import axios from "axios"; // Removed unused import
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert, InputGroup } from "react-bootstrap";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import logo from "../assets/monevo.png";
import loginBg from "../assets/login-bg.jpg";
import Header from "./Header";
import { useAuth } from "./AuthContext";
// import ReCAPTCHA from "react-google-recaptcha";

function Login() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    remember_me: false,
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // const [captchaToken, setCaptchaToken] = useState("");
  // const recaptchaRef = useRef(null);
  const navigate = useNavigate();
  const { loginUser, isAuthenticated } = useAuth();

  // Check if we're in production environment

  // Check if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/all-topics");
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  // const handleCaptchaChange = (token) => {
  //   setCaptchaToken(token);
  // };

  const handleLogin = async (e) => {
    e.preventDefault();

    // Only validate reCAPTCHA in production
    // if (isProduction && !captchaToken) {
    //   setError("Please complete the reCAPTCHA verification.");
    //   return;
    // }

    setIsLoading(true);
    setError("");

    try {
      // Clear any stored tokens first to prevent token validation issues
      document.cookie =
        "refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

      const loginData = {
        ...formData,
        // Only include recaptcha_token in production
        // ...(isProduction && { recaptcha_token: captchaToken }),
      };

      console.log("Attempting login with:", { username: loginData.username });
      const result = await loginUser(loginData);

      if (!result.success) {
        console.error("Login failed:", result.error);
        setError(result.error || "Login failed. Please try again.");
        // if (recaptchaRef.current) {
        //   recaptchaRef.current.reset();
        // }
      } else {
        console.log("Login successful");
      }
    } catch (error) {
      console.error("Login failed", error);
      setError(
        error.response?.data?.detail ||
          error.response?.data?.error ||
          "An unexpected error occurred. Please try again."
      );
      // if (recaptchaRef.current) {
      //   recaptchaRef.current.reset();
      // }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="split-screen">
      <Header />
      <div
        className="split-screen__image"
        style={{ backgroundImage: `url(${loginBg})` }}
      ></div>

      <div className="split-screen__form">
        <div className="auth-container">
          <img src={logo} alt="Logo" className="auth-logo" />
          <h2 className="auth-heading">Welcome Back!</h2>
          <p className="text-center text-muted mb-4">
            Please enter your credentials to continue
          </p>

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
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
                placeholder="Enter your username"
                required
                autoComplete="username"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                  className="password-toggle-btn"
                >
                  {showPassword ? <EyeSlash /> : <Eye />}
                </Button>
              </InputGroup>
            </Form.Group>

            <div className="d-flex justify-content-between align-items-center mb-4">
              <Form.Check
                type="checkbox"
                id="remember-me"
                name="remember_me"
                label="Remember me"
                checked={formData.remember_me}
                onChange={handleChange}
                className="mb-0"
              />
              <Button
                variant="link"
                onClick={() => navigate("/forgot-password")}
                className="text-decoration-none p-0"
              >
                Forgot Password?
              </Button>
            </div>

            {/* Only show reCAPTCHA in production */}
            {/* {isProduction && (
              <div className="mb-4 d-flex justify-content-center">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={
                    process.env.REACT_APP_RECAPTCHA_SITE_KEY ||
                    "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                  }
                  onChange={handleCaptchaChange}
                />
              </div>
            )} */}

            <div className="d-grid gap-3 mb-4">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                className="btn-3d"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>

            <div className="text-center">
              <p className="mb-0">
                Don't have an account?{" "}
                <Button
                  variant="link"
                  onClick={() => navigate("/register")}
                  className="text-decoration-none p-0"
                >
                  Sign up now
                </Button>
              </p>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default Login;
