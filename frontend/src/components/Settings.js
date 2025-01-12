import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Settings.css"; // New CSS file
import Chatbot from "./Chatbot";

function Settings() {
  const [emailReminders, setEmailReminders] = useState(false);
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem("accessToken");
      try {
        const response = await axios.get(
          "http://localhost:8000/api/user/settings/",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setEmailReminders(response.data.email_reminders || false);
        setProfileData(response.data.profile || {});
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
  }, []);

  const handleToggle = async () => {
    const token = localStorage.getItem("accessToken");
    try {
      await axios.patch(
        "http://localhost:8000/api/user/settings/",
        { email_reminders: !emailReminders },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmailReminders((prev) => !prev);
      setSuccessMessage("Notification settings updated!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h2 className="settings-title">Settings</h2>

        {successMessage && (
          <p className="success-message">{successMessage}</p>
        )}

        <form>
          <div className="form-group">
            <label className="form-label">First Name</label>
            <input
              type="text"
              name="first_name"
              className="form-control"
              value={profileData.first_name}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Last Name</label>
            <input
              type="text"
              name="last_name"
              className="form-control"
              value={profileData.last_name}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              name="username"
              className="form-control"
              value={profileData.username}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-control"
              value={profileData.email}
              onChange={handleInputChange}
            />
          </div>
        </form>

        <h3 className="notifications-title">Notification Settings</h3>
        <div className="form-check">
          <label className="form-check-label">
            <input
              type="checkbox"
              className="form-check-input"
              checked={emailReminders}
              onChange={handleToggle}
            />
            Receive Email Reminders
          </label>
        </div>
      </div>
      <Chatbot />
    </div>
  );
}

export default Settings;
