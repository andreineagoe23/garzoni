// components/CookiePolicy.js
import React from 'react';
import { Container } from 'react-bootstrap';

const CookiePolicy = () => (
  <Container className="policy-page">
    <h1>Cookie Policy</h1>
    <p>Last updated: [Date]</p>

    <h2>Essential Cookies</h2>
    <p>Authentication and session management cookies...</p>

    <h2>Analytical Cookies</h2>
    <table className="cookie-table">
      <thead>
        <tr>
          <th>Service</th>
          <th>Purpose</th>
          <th>Provider</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Google Analytics</td>
          <td>Usage tracking</td>
          <td>Google LLC</td>
        </tr>
        <tr>
          <td>Usercentrics</td>
          <td>Consent management</td>
          <td>Usercentrics GmbH</td>
        </tr>
      </tbody>
    </table>
  </Container>
);

export default CookiePolicy;