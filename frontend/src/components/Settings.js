import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import Chatbot from "./Chatbot";

function Settings() {
  const [emailReminders, setEmailReminders] = useState(false);
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
  });

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
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="container my-5">
      <div className="card p-4 shadow-sm">
        <h2 className="text-center mb-4">Settings</h2>

        <form>
          <div className="mb-3">
            <label className="form-label">First Name</label>
            <input
              type="text"
              name="first_name"
              className="form-control"
              value={profileData.first_name}
              onChange={handleInputChange}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Last Name</label>
            <input
              type="text"
              name="last_name"
              className="form-control"
              value={profileData.last_name}
              onChange={handleInputChange}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Username</label>
            <input
              type="text"
              name="username"
              className="form-control"
              value={profileData.username}
              onChange={handleInputChange}
            />
          </div>

          <div className="mb-3">
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

        <h3 className="mt-4">Notification Settings</h3>
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
      <Chatbot />
    </div>
  );
}

export default Settings;
