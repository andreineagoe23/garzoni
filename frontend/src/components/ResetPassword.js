import React, { useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

function ResetPassword() {
  const { uidb64, token } = useParams(); // Extract from URL
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        "http://localhost:8000/password-reset-confirm/" +
          uidb64 +
          "/" +
          token +
          "/",
        {
          password,
        }
      );

      setMessage("Password reset successfully!");
      setError("");
    } catch (error) {
      setError("Failed to reset password. Please try again.");
      setMessage("");
    }
  };

  return (
    <div className="reset-password-container">
      <h2>Reset Password</h2>
      <form onSubmit={handleResetPassword}>
        <label>New Password:</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Reset Password</button>
      </form>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default ResetPassword;
