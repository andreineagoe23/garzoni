import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "./ThemeContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/scss/main.scss";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Settings() {
  const { darkMode, toggleDarkMode } = useTheme();
  const [emailReminderPreference, setEmailReminderPreference] =
    useState("none");
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [localDarkMode, setLocalDarkMode] = useState(darkMode);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );

        console.log("Settings response:", response.data);

        // Update all settings from backend
        const profile = response.data?.profile || {};
        setEmailReminderPreference(
          response.data.email_reminder_preference || "none"
        );
        setProfileData({
          username: profile.username || "",
          email: profile.email || "",
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
        });

        // Set local dark mode state
        setLocalDarkMode(response.data.dark_mode || false);
      } catch (error) {
        console.error("Error fetching settings:", error);
        setErrorMessage("Failed to load settings. Please try again.");
      }
    };
    fetchSettings();
  }, [getAccessToken]);

  const handleSaveSettings = async () => {
    try {
      setErrorMessage("");
      const response = await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
        {
          profile: {
            username: profileData.username,
            email: profileData.email,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
          },
          email_reminder_preference: emailReminderPreference,
          dark_mode: localDarkMode,
        },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Settings updated response:", response.data);
      setSuccessMessage("Settings updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);

      // Update global dark mode state after successful save
      toggleDarkMode(localDarkMode);
    } catch (error) {
      console.error("Error updating settings:", error);
      setErrorMessage("Failed to save settings. Please try again.");
    }
  };

  const handleDarkModeToggle = (e) => {
    const newDarkMode = e.target.checked;
    setLocalDarkMode(newDarkMode);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="settings-container">
      <div className="content-wrapper">
        {successMessage && (
          <div className="alert alert-success">{successMessage}</div>
        )}

        {errorMessage && (
          <div className="alert alert-danger">{errorMessage}</div>
        )}

        <div className="form-layout-narrow">
          <div className="card">
            <div className="card-body">
              <h4 className="section-title mb-4">Profile Information</h4>

              <div className="two-column-layout gap-4">
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

              <h4 className="section-title mt-5 mb-4">Preferences</h4>

              <div className="form-group toggle-group">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="darkModeToggle"
                    checked={localDarkMode}
                    onChange={handleDarkModeToggle}
                  />
                  <label className="form-check-label" htmlFor="darkModeToggle">
                    Dark Mode
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Email Reminders</label>
                <select
                  className="form-select"
                  value={emailReminderPreference}
                  onChange={(e) => setEmailReminderPreference(e.target.value)}
                >
                  <option value="none">No Reminders</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div className="legal-links mt-4 d-flex gap-2 justify-content-center">
                <button
                  type="button"
                  className="btn btn-link p-0 text-muted small text-decoration-none"
                  onClick={() => window.UC_UI?.showSecondLayer()}
                >
                  Privacy Settings
                </button>
                <span className="text-muted">•</span>
                <Link
                  to="/cookie-policy"
                  className="btn btn-link p-0 text-muted small text-decoration-none"
                >
                  Cookie Policy
                </Link>
              </div>

              <button
                className="btn btn-accent w-100 mt-5"
                onClick={handleSaveSettings}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
