import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "./ThemeContext";
import Cookies from "js-cookie";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/scss/main.scss";

function Settings() {
  const { darkMode, toggleDarkMode } = useTheme();
  const [emailReminders, setEmailReminders] = useState(false);
  const [emailFrequency, setEmailFrequency] = useState("daily");
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
          { withCredentials: true }
        );

        // Update all settings from backend
        const profile = response.data?.profile || {};
        setEmailReminders(response.data.email_reminders);
        setEmailFrequency(response.data.email_frequency);
        setProfileData({
          username: profile.username,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
        });

        // Sync dark mode with backend and cookies
        const serverDarkMode = response.data.dark_mode;
        Cookies.set("darkMode", serverDarkMode.toString(), {
          expires: 365,
          sameSite: "strict",
        });
        toggleDarkMode(serverDarkMode);
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, [toggleDarkMode]);

  const handleSaveSettings = async () => {
    try {
      await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
        {
          email_reminders: emailReminders,
          email_frequency: emailFrequency,
          dark_mode: darkMode,
        },
        { withCredentials: true }
      );
      setSuccessMessage("Settings updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  };

  const handleDarkModeToggle = (e) => {
    const newDarkMode = e.target.checked;
    toggleDarkMode(newDarkMode);
    Cookies.set("darkMode", newDarkMode.toString(), {
      expires: 365,
      sameSite: "strict",
    });
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
          <div className="success-message">{successMessage}</div>
        )}

        <form>
          <h4 className="mb-4">Profile Information</h4>
          <div className="form-group">
            <label htmlFor="first_name">First Name</label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              className="form-control"
              value={profileData.first_name}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="last_name">Last Name</label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              className="form-control"
              value={profileData.last_name}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              className="form-control"
              value={profileData.username}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-control"
              value={profileData.email}
              onChange={handleInputChange}
            />
          </div>

          <h4 className="mb-4 mt-5">Notification Preferences</h4>
          <div className="toggle-switch">
            <label htmlFor="emailReminders">Email Reminders</label>
            <input
              type="checkbox"
              className="form-check-input"
              id="emailReminders"
              checked={emailReminders}
              onChange={(e) => setEmailReminders(e.target.checked)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="emailFrequency">Email Frequency</label>
            <select
              id="emailFrequency"
              className="form-select"
              value={emailFrequency}
              onChange={(e) => setEmailFrequency(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="dark-mode-toggle toggle-switch">
            <label htmlFor="darkModeToggle">Dark Mode</label>
            <input
              type="checkbox"
              className="form-check-input"
              id="darkModeToggle"
              checked={darkMode}
              onChange={handleDarkModeToggle}
            />
          </div>

          <button
            type="button"
            className="save-button"
            onClick={handleSaveSettings}
          >
            Save Settings
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;
