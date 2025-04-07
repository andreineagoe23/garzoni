import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTheme } from "./ThemeContext";
import Cookies from "js-cookie";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/scss/main.scss";
import { Link } from "react-router-dom";

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
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
          }
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
        if (serverDarkMode !== undefined) {
          Cookies.set("darkMode", serverDarkMode.toString(), {
            expires: 365,
            sameSite: "strict",
          });
          toggleDarkMode(serverDarkMode);
        }
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
          // Add profile fields
          profile: {
            username: profileData.username,
            email: profileData.email,
            first_name: profileData.first_name,
            last_name: profileData.last_name,
          },
          email_reminders: emailReminders,
          email_frequency: emailFrequency,
          dark_mode: darkMode,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
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
      <div className="content-wrapper">
        {successMessage && (
          <div className="alert alert-success">{successMessage}</div>
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
                    checked={darkMode}
                    onChange={handleDarkModeToggle}
                  />
                  <label className="form-check-label" htmlFor="darkModeToggle">
                    Dark Mode
                  </label>
                </div>
              </div>

              <div className="form-group toggle-group">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="emailReminders"
                    checked={emailReminders}
                    onChange={(e) => setEmailReminders(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="emailReminders">
                    Email Reminders
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Email Frequency</label>
                <select
                  className="form-select"
                  value={emailFrequency}
                  onChange={(e) => setEmailFrequency(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
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
