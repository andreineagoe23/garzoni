import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Profile.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Chatbot from "./Chatbot";

function Profile() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    earned_money: 0.0,
    points: 0,
    streak: 0,
  });
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState(
    localStorage.getItem("avatarUrl") || null
  );
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("accessToken");
      try {
        const response = await axios.get(
          "http://localhost:8000/api/userprofile/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setProfileData({
          username: response.data.username || "",
          email: response.data.email || "",
          first_name: response.data.first_name || "",
          last_name: response.data.last_name || "",
          earned_money: parseFloat(response.data.earned_money) || 0.0,
          points: response.data.points || 0,
          streak: response.data.streak || 0,
        });

        // Fetch recent activity (mocked for now)
        setRecentActivity([
          {
            id: 1,
            activity: "Completed Basic Finance Course",
            date: "2025-01-10",
          },
          { id: 2, activity: "Earned 50 points", date: "2025-01-08" },
        ]);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };

    fetchProfile();
  }, []);

  const handleAvatarChange = async () => {
    try {
      const apiKey = process.env.REACT_APP_RECRAFT_API_KEY;
      const token = localStorage.getItem("accessToken");

      const response = await axios.post(
        "https://external.api.recraft.ai/v1/images/generations",
        {
          prompt,
          style: "digital_illustration",
          model: "recraftv3",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      const imageData = response.data.data[0].url;

      // Save to backend
      await axios.post(
        "http://localhost:8000/api/userprofiles/save-avatar/",
        { avatar_url: imageData },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update local state
      setImageUrl(imageData);
      localStorage.setItem("avatarUrl", imageData);
    } catch (error) {
      console.error("Error generating image:", error);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    const token = localStorage.getItem("accessToken");
    try {
      const response = await axios.post(
        "http://localhost:8000/api/userprofiles/upload-avatar/",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setImageUrl(response.data.avatar_url);
      localStorage.setItem("avatarUrl", response.data.avatar_url);
    } catch (error) {
      console.error("Error uploading avatar:", error);
    }
  };

  return (
    <div className="container profile-container my-5">
      <div className="card p-4 shadow-sm">
        <h2 className="text-center mb-4">Profile</h2>

        <div className="text-center mb-4">
          <img
            src={imageUrl || "/default-avatar.png"}
            alt="Avatar"
            className="rounded-circle"
            width="150"
            height="150"
          />
          <div className="mt-3">
            <input
              type="text"
              placeholder="Enter image prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="form-control"
            />
            <button
              onClick={handleAvatarChange}
              className="btn btn-primary mt-2"
            >
              Generate Avatar
            </button>
            <div className="mt-3">
              <input type="file" onChange={handleAvatarUpload} />
            </div>
          </div>
        </div>

        <div className="mb-3">
          <h4 className="text-muted">Balance:</h4>
          <p className="h5">${profileData.earned_money.toFixed(2)}</p>
        </div>
        <div className="mb-3">
          <h4 className="text-muted">Points:</h4>
          <p className="h5">{profileData.points}</p>
        </div>
        <div className="mb-3">
          <h4 className="text-muted">Streak:</h4>
          <p className="h5">{profileData.streak} days</p>
        </div>

        <h3 className="mt-4">Recent Activity</h3>
        <ul className="list-group">
          {recentActivity.map((activity) => (
            <li key={activity.id} className="list-group-item">
              <strong>{activity.activity}</strong>
              <span className="text-muted float-end">{activity.date}</span>
            </li>
          ))}
        </ul>
      </div>
      <Chatbot />
    </div>
  );
}

export default Profile;
