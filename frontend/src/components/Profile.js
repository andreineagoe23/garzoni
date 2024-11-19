import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Profile.css";

function Profile() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0.0, // Add default balance
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("accessToken");
      try {
        const response = await axios.get(
          "http://localhost:8000/api/userprofiles/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = response.data;

        setProfileData({
          username: data.username || "",
          email: data.email || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          earned_money: data.earned_money || 0.0,
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  const handleProfileUpdate = async () => {
    const token = localStorage.getItem("accessToken");
    const formData = new FormData();
    formData.append("username", profileData.username);
    formData.append("email", profileData.email);
    formData.append("first_name", profileData.first_name);
    formData.append("last_name", profileData.last_name);
    formData.append("earned_money", profileData.earned_money); // Include earned_money
    if (profilePicture) formData.append("profile_picture", profilePicture);

    try {
      const response = await axios.put(
        "http://localhost:8000/api/userprofiles/",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setMessage("Profile updated successfully!");

      // Update the frontend state with the new data
      setProfileData((prevData) => ({
        ...prevData,
        earned_money: parseFloat(response.data.earned_money),
      }));
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Failed to update profile.");
    }
  };

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      <div>
        <h3>Balance:</h3>
        <p>
          {profileData.earned_money
            ? profileData.earned_money.toFixed(2)
            : "0.00"}
        </p>
      </div>
      <form onSubmit={(e) => e.preventDefault()}>
        <div>
          <label>First Name:</label>
          <input
            type="text"
            value={profileData.first_name}
            onChange={(e) =>
              setProfileData({ ...profileData, first_name: e.target.value })
            }
          />
        </div>
        <div>
          <label>Last Name:</label>
          <input
            type="text"
            value={profileData.last_name}
            onChange={(e) =>
              setProfileData({ ...profileData, last_name: e.target.value })
            }
          />
        </div>
        <div>
          <label>Username:</label>
          <input
            type="text"
            value={profileData.username}
            onChange={(e) =>
              setProfileData({ ...profileData, username: e.target.value })
            }
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={profileData.email}
            onChange={(e) =>
              setProfileData({ ...profileData, email: e.target.value })
            }
          />
        </div>
        <div>
          <label>Profile Picture:</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProfilePicture(e.target.files[0])}
          />
        </div>
        <button type="button" onClick={handleProfileUpdate}>
          Save Changes
        </button>
        {message && <p>{message}</p>}
      </form>
    </div>
  );
}

export default Profile;
