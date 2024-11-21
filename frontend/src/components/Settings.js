import React, { useState, useEffect } from "react";
import axios from "axios";

function Settings() {
  const [emailReminders, setEmailReminders] = useState(false);

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
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEmailReminders((prev) => !prev);
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  };

  return (
    <div>
      <h2>Notification Settings</h2>
      <label>
        <input
          type="checkbox"
          checked={emailReminders}
          onChange={handleToggle}
        />
        Receive Email Reminders
      </label>
    </div>
  );
}

export default Settings;
