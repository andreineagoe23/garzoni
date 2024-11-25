import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Profile.css";
import "bootstrap/dist/css/bootstrap.min.css";

function Profile() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0.0,
    points: 0,
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("accessToken");
      console.log("Fetching profile data...");

      try {
        const response = await axios.get(
          "http://localhost:8000/api/userprofile/", // Ensure this endpoint returns the current user data
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("Profile data fetched:", response.data);

        setProfileData({
          username: response.data.username || "",
          email: response.data.email || "",
          first_name: response.data.first_name || "",
          last_name: response.data.last_name || "",
          earned_money: parseFloat(response.data.earned_money) || 0.0,
          points: response.data.points || 0,
        });
      } catch (error) {
        console.error("Error fetching profile data:", error);
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
    if (profilePicture) formData.append("profile_picture", profilePicture);

    console.log("Updating profile with data:", {
      username: profileData.username,
      email: profileData.email,
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      profilePicture,
    });

    try {
      const response = await axios.put(
        "http://localhost:8000/api/userprofiles/update/", // Endpoint to update the profile
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Profile updated successfully:", response.data);
      setMessage("Profile updated successfully!");
      setProfileData({
        ...profileData,
        earned_money: parseFloat(response.data.earned_money),
        points: response.data.points,
      });
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
            $
            {isNaN(profileData.earned_money)
              ? "0.00"
              : profileData.earned_money.toFixed(2)}
          </p>
        </div>

        <div className="mb-3">
          <h4 className="text-muted">Points:</h4>
          <p className="h5">{profileData.points || 0}</p>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="mb-3">
            <label className="form-label">First Name</label>
            <input
              type="text"
              className="form-control"
              value={profileData.first_name || ""}
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

          {message && (
            <p className="mt-3 text-center text-success">{message}</p>
          )}
        </form>
      </div>
    </div>
  );
}

export default Profile;
