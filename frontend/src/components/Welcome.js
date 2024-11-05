import React from "react";
import { useNavigate } from "react-router-dom";

function Welcome() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/register");
  };

  const handleLogin = () => {
    navigate("/login");
  };

  return (
    <div>
      <h1>The free, fun, and effective way to learn about finance topics!</h1>
      <button onClick={handleGetStarted}>Get Started</button>
      <button onClick={handleLogin}>Already Have an Account?</button>
    </div>
  );
}

export default Welcome;
