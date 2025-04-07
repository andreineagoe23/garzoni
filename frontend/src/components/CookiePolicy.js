import React, { useEffect, useRef } from "react";
import { Container } from "react-bootstrap";

const CookiePolicy = () => {
  const declarationRef = useRef(null);

  useEffect(() => {
    const container = declarationRef.current; // Capture current ref value
    if (!container) return;

    // Clear existing content first
    container.innerHTML = '';

    const script = document.createElement("script");
    script.id = "CookieDeclaration";
    script.src = "https://consent.cookiebot.com/12b9cf17-1f30-4bd3-8327-7a29ec5d4ee1/cd.js";
    script.async = true;
    script.dataset.cbid = "12b9cf17-1f30-4bd3-8327-7a29ec5d4ee1";
    
    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
      document.querySelectorAll('[data-cookieconsent], .CookiebotAlert').forEach(el => el.remove());
    };
  }, []);

  return (
    <Container className="policy-page mt-5 p-4 border rounded shadow">
      <h1 className="text-center mb-4">Cookie Policy</h1>
      <div ref={declarationRef} id="cookie-declaration" className="bg-light p-3 rounded"></div>
    </Container>
  );
};

export default CookiePolicy;
