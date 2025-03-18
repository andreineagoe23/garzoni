import React, { useState, useEffect } from "react";
import "../styles/scss/main.scss";
import axios from "axios";

function DonationCauses({ onDonate }) {
  const [donationCauses, setDonationCauses] = useState([]);

  useEffect(() => {
    const fetchDonationCauses = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/rewards/donate/`,
          { withCredentials: true }
        );
        setDonationCauses(response.data);
      } catch (error) {
        console.error("Error fetching donation causes:", error);
      }
    };
    fetchDonationCauses();
  }, []);

  const handleDonate = async (rewardId) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/purchases/`,
        { reward_id: rewardId },
        { withCredentials: true }
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
    <div className="donate-container">
      <h2 className="text-center">Donation Causes</h2>
      <div className="causes-grid">
        {donationCauses.map((cause) => (
          <div key={cause.id} className="donation-card">
            <img src={cause.image} alt={cause.name} className="cause-image" />
            <div className="card-body">
              <h5 className="card-title">{cause.name}</h5>
              <p className="card-text">{cause.description}</p>
            </div>
            <div className="card-footer">
              <div className="donation-info">
                <span className="item-cost">{cause.cost} coins</span>
                <span className="organization">
                  {cause.donation_organization}
                </span>
              </div>
              <button
                className="donate-button"
                onClick={() => handleDonate(cause.id)}
              >
                Donate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DonationCauses;
