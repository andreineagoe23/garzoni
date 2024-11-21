import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Profile.css"; // Include your custom styles
import "bootstrap/dist/css/bootstrap.min.css"; // Include Bootstrap styles

function Profile() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0.0,
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
    formData.append("earned_money", profileData.earned_money);
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
    <div className="container profile-container my-5">
      <div className="card p-4 shadow-sm">
        <h2 className="text-center mb-4">Profile</h2>

        <div className="mb-3">
          <h4 className="text-muted">Balance:</h4>
          <p className="h5 balance">
            ${profileData.earned_money ? profileData.earned_money.toFixed(2) : "0.00"}
          </p>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="mb-3">
            <label className="form-label">First Name</label>
            <input
              type="text"
              className="form-control"
              value={profileData.first_name}
              onChange={(e) =>
                setProfileData({ ...profileData, first_name: e.target.value })
              }
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Last Name</label>
            <input
              type="text"
              className="form-control"
              value={profileData.last_name}
              onChange={(e) =>
                setProfileData({ ...profileData, last_name: e.target.value })
              }
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              value={profileData.username}
              onChange={(e) =>
                setProfileData({ ...profileData, username: e.target.value })
              }
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={profileData.email}
              onChange={(e) =>
                setProfileData({ ...profileData, email: e.target.value })
              }
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Profile Picture</label>
            <input
              type="file"
              className="form-control"
              accept="image/*"
              onChange={(e) => setProfilePicture(e.target.files[0])}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary w-100"
            onClick={handleProfileUpdate}
          >
            Save Changes
          </button>

          {message && <p className="mt-3 text-center text-success">{message}</p>}
        </form>
      </div>
    </div>
  );
}

export default Profile;
