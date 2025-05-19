import React, { useState, useEffect } from "react";
import "../styles/scss/main.scss";
import axios from "axios";
import { useAuth } from "./AuthContext";

function DonationCauses({ onDonate }) {
  const [donationCauses, setDonationCauses] = useState([]);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    const fetchDonationCauses = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/rewards/donate/`,
          {
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          }
        );
        setDonationCauses(response.data);
      } catch (error) {
        console.error("Error fetching donation causes:", error);
      }
    };
    fetchDonationCauses();
  }, [getAccessToken]);

  const handleDonate = async (rewardId) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/purchases/`,
        { reward_id: rewardId },
        {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );

      if (response.status === 201) {
        alert("Donation successful!");
        onDonate(); // Trigger balance refresh
      }
    } catch (error) {
      console.error("Error donating:", error);
      alert(error.response?.data?.error || "Failed to donate.");
    }
  };

  return (
    <div className="shop-container">
      <h2 className="text-center">Donation Causes</h2>
      <div className="items-grid">
        {donationCauses.map((cause) => (
          <div key={cause.id} className="item-card">
            <img src={cause.image} alt={cause.name} className="item-image" />
            <div className="card-body">
              <h5 className="card-title">{cause.name}</h5>
              <p className="card-text">{cause.description}</p>
            </div>
            <div className="card-footer">
              <div className="d-flex justify-content-between align-items-center w-100">
                <span className="item-cost">{cause.cost} coins</span>
                <span className="organization text-muted small">
                  {cause.donation_organization}
                </span>
              </div>
              <button
                className="buy-button w-100 mt-3"
                onClick={() => handleDonate(cause.id)}
              >
                Donate Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DonationCauses;
