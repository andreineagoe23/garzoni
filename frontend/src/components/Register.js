import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Button, Alert, InputGroup } from "react-bootstrap";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import logo from "../assets/monevo.png";
import registerBg from "../assets/register-bg.jpg";
import Header from "./Header";
import { useAuth } from "./AuthContext";
import ReCAPTCHA from "react-google-recaptcha";

function Register() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    first_name: "",
    last_name: "",
    referral_code: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const recaptchaRef = useRef(null);

  const navigate = useNavigate();
  const { registerUser } = useAuth();

  const handleChange = (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    // Validate reCAPTCHA
    if (!captchaToken) {
      setErrorMessage("Please complete the reCAPTCHA verification.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const registerData = {
        ...formData,
        recaptcha_token: captchaToken,
      };

      const result = await registerUser(registerData);

      if (result.success) {
        navigate(result.next);
      } else {
        setErrorMessage(result.error);
        if (recaptchaRef.current) {
          recaptchaRef.current.reset();
        }
      }
    } catch (error) {
      console.error("Registration failed", error);
      setErrorMessage(
        error.response?.data?.error || "Registration failed. Please try again."
      );
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="split-screen">
      <Header />
      <div
        className="split-screen__image"
        style={{ backgroundImage: `url(${registerBg})` }}
      ></div>

      <div className="split-screen__form">
        <div className="auth-container">
          <img src={logo} alt="Logo" className="auth-logo" />
          <h2 className="auth-heading">Create Your Account</h2>
          <p
            className="text-center text-muted mb-4"
            style={{ fontSize: "0.9rem" }}
          >
            Join us and start your financial journey
          </p>

          {errorMessage && (
            <Alert variant="danger" className="mb-4">
              {errorMessage}
            </Alert>
          )}

          <Form onSubmit={handleRegister}>
            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-4">
                  <Form.Label>First Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="Enter your first name"
                    required
                    autoComplete="given-name"
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-4">
                  <Form.Label>Last Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Enter your last name"
                    required
                    autoComplete="family-name"
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-4">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
                autoComplete="username"
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                autoComplete="email"
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
                  placeholder="Create a password"
                  required
                  autoComplete="new-password"
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

            <Form.Group className="mb-4">
              <Form.Label>Referral Code (optional)</Form.Label>
              <Form.Control
                type="text"
                name="referral_code"
                value={formData.referral_code}
                onChange={handleChange}
                placeholder="Enter referral code if you have one"
              />
            </Form.Group>

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

            <div className="d-grid gap-3 mb-4">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                className="btn-3d"
                disabled={isLoading || !captchaToken}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </div>

            <div className="text-center">
              <p className="mb-0" style={{ fontSize: "0.9rem" }}>
                Already have an account?{" "}
                <Button
                  variant="link"
                  onClick={() => navigate("/login")}
                  className="text-decoration-none p-0"
                >
                  Login here
                </Button>
              </p>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default Register;
