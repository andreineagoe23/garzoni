import React from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
import { Robot, Compass, Trophy } from "react-bootstrap-icons";
import Header from "../components/Header";
import logo from "../assets/monevo.png";
import mockup1 from "../assets/mobile-1.png";
import mockup2 from "../assets/mobile-2.png";
import mockup3 from "../assets/mobile-3.png";

function Welcome() {
  const navigate = useNavigate();

  const featureSections = [
    {
      icon: <Robot size={60} className="text-primary" />,
      title: "AI Finance Assistant",
      text: "24/7 chatbot with real-time market data & personalized advice",
      mockup: mockup1,
    },
    {
      icon: <Compass size={60} className="text-primary" />,
      title: "Personalized Learning Paths",
      text: "Custom curriculum based on your goals and skill level",
      mockup: mockup2,
    },
    {
      icon: <Trophy size={60} className="text-primary" />,
      title: "Gamified Learning",
      text: "Earn badges, points, and climb leaderboards",
      mockup: mockup3,
    },
  ];

  return (
    <div className="app-container welcome-page">
      <Header />
      <Container className="py-5">
        {/* Hero Section */}
        <div className="text-center mb-5">
          <img
            src={logo}
            alt="Monevo Logo"
            className="welcome-logo img-fluid mb-4"
            style={{ maxWidth: "200px" }}
          />

          <h1 className="welcome-heading display-5 mb-4 fw-bold">
            Master Your Finances - The Smart Way!
          </h1>

          <div className="d-grid gap-3 mx-auto" style={{ maxWidth: "400px" }}>
            <button
              className="btn btn-accent btn-3d btn-lg py-3"
              onClick={() => navigate("/register")}
            >
              Start Free Journey
            </button>

            <button
              className="btn btn-outline-accent btn-3d btn-lg py-3"
              onClick={() => navigate("/login")}
            >
              Already Signed Up?
            </button>
          </div>
        </div>

        {/* Feature Sections with Mockups */}
        {featureSections.map((feature, index) => (
          <section key={index} className="feature-section py-5">
            <Row
              className={`align-items-center g-5 ${
                index % 2 === 0 ? "" : "flex-row-reverse"
              }`}
            >
              <Col md={6}>
                <div className="feature-content">
                  <div className="feature-icon mb-4">{feature.icon}</div>
                  <h2 className="display-5 fw-bold mb-3">{feature.title}</h2>
                  <p className="lead text-muted mb-4">{feature.text}</p>
                  <ul className="feature-benefits list-unstyled">
                    <li>✓ Real-time market insights</li>
                    <li>✓ Interactive exercises</li>
                    <li>✓ Progress tracking</li>
                  </ul>
                </div>
              </Col>

              <Col md={6}>
                <div className="feature-mockup bg-primary-light p-4 rounded-4 shadow-lg">
                  <img
                    src={feature.mockup}
                    alt={feature.title}
                    className="img-fluid"
                  />
                </div>
              </Col>
            </Row>
          </section>
        ))}

        {/* Final CTA Section */}
        <div className="text-center mt-5 pt-4">
          <button
            className="btn btn-accent btn-3d btn-lg px-5 py-3"
            onClick={() => navigate("/register")}
          >
            Start Learning Free Today
          </button>
          <p className="text-muted mt-3 small">
            Join our community of smart learners - No credit card required
          </p>
        </div>
      </Container>
    </div>
  );
}

export default Welcome;
