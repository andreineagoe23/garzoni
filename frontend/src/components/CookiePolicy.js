import React, { useEffect } from "react";
import { Container } from "react-bootstrap";
import "../styles/scss/main.scss";

const CookiePolicy = () => {
  useEffect(() => {
    // Dynamically load Cookie Declaration
    const script = document.createElement("script");
    script.id = "CookieDeclaration";
    script.src =
      "https://consent.cookiebot.com/12b9cf17-1f30-4bd3-8327-7a29ec5d4ee1/cd.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.getElementById("CookieDeclaration")?.remove();
    };
  }, []);

  return (
    <Container className="policy-page mt-5 p-4 border rounded shadow">
      <h1 className="text-center mb-4">Cookie Policy</h1>
      <div id="cookie-declaration" className="bg-light p-3 rounded"></div>
    </Container>
  );
};

export default CookiePolicy;
