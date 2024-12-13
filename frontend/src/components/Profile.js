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
  const [profilePicture, setProfilePicture] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState(
    localStorage.getItem("avatarUrl") || null
  );

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
      } catch (error) {
        console.error("Error fetching profile data:", error);
      }
    };

    fetchProfile();
  }, []);

  const handleAvatarChange = async () => {
    try {
      // Authentication setup for Recraft.ai API
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
            Authorization: `Bearer 4PGE2S5ROOZ0fsYiN1sNgByBZQU3xeuYuScmdZqJ57jqeXTd7U4ESHj2D9eIhh8a`, // Replace with your Recraft API token
          },
        }
      );

      const imageData = response.data.data[0].url;
      const imgBlob = await fetch(imageData).then((res) => res.blob());
      const imgUrl = URL.createObjectURL(imgBlob);

      setImageUrl(imgUrl);
      localStorage.setItem("avatarUrl", imgUrl);
    } catch (error) {
      console.error("Error generating image:", error);
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
          <p className="h5">{profileData.streak}</p>
        </div>
      </div>
      <Chatbot />
    </div>
  );
}

export default Profile;
