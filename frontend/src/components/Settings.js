import React, { useState, useEffect } from "react";
import axios from "axios";

function Settings() {
    const [emailReminders, setEmailReminders] = useState(false);

    useEffect(() => {
        axios.get("/api/userprofiles/me/").then((response) => {
            setEmailReminders(response.data.email_reminders);
        });
    }, []);

    const handleToggle = () => {
        axios.patch("/api/userprofiles/me/", { email_reminders: !emailReminders })
            .then(() => setEmailReminders(!emailReminders));
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
