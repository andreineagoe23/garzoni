import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "./ThemeContext";
import Cookies from 'js-cookie';
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Settings.css";

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
        Cookies.set('darkMode', serverDarkMode.toString(), { expires: 365, sameSite: 'strict' });
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
    Cookies.set('darkMode', newDarkMode.toString(), { expires: 365, sameSite: 'strict' });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="settings-container">
      <h2>Settings</h2>
      {successMessage && <p className="success-message">{successMessage}</p>}

      <form>
        {/* Existing form fields */}
        <div className="form-group">
          <label>First Name</label>
          <input
            type="text"
            name="first_name"
            className="form-control"
            value={profileData.first_name}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Last Name</label>
          <input
            type="text"
            name="last_name"
            className="form-control"
            value={profileData.last_name}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            className="form-control"
            value={profileData.username}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            className="form-control"
            value={profileData.email}
            onChange={handleInputChange}
          />
        </div>
      </form>

      <div className="form-group">
        <label>Email Reminders</label>
        <input
          type="checkbox"
          checked={emailReminders}
          onChange={(e) => setEmailReminders(e.target.checked)}
        />
      </div>

      <div className="form-group">
        <label>Email Frequency</label>
        <select
          value={emailFrequency}
          onChange={(e) => setEmailFrequency(e.target.value)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className="form-group dark-mode-toggle">
        <label>Dark Mode</label>
        <input
          type="checkbox"
          checked={darkMode}
          onChange={handleDarkModeToggle}
        />
      </div>

      <button className="save-button" onClick={handleSaveSettings}>
        Save Settings
      </button>
    </div>
  );
}

export default Settings;