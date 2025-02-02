import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Settings.css";

function Settings() {
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
      const token = localStorage.getItem("accessToken");
      if (!token) {
        console.error("No access token found. Please log in.");
        return;
      }

      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const profile = response.data?.profile || {};
        setEmailReminders(response.data?.email_reminders || false);
        setEmailFrequency(response.data?.email_frequency || "daily");
        setProfileData({
          username: profile.username || "",
          email: profile.email || "",
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
        });
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    const token = localStorage.getItem("accessToken");
    try {
      await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}/user/settings/`,
        {
          email_reminders: emailReminders,
          email_frequency: emailFrequency,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMessage("Settings updated successfully!");
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
      <h2>Settings</h2>

      {successMessage && <p className="success-message">{successMessage}</p>}

      <form>
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

      <button onClick={handleSaveSettings}>Save Settings</button>
    </div>
  );
}

export default Settings;
