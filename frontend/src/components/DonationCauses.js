import React, { useState, useEffect } from "react";
import styles from "../styles/RewardsPage.module.css";
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
    <div className={`${styles.donateContainer} container`}>
      <h2 className="text-center mb-4">Donate</h2>
      <div className="row">
        {donationCauses.map((cause) => (
          <div
            key={cause.id}
            className="col-12 col-sm-6 col-md-4 col-lg-3 mb-4"
          >
            <div className={`${styles.itemCard} card shadow-sm`}>
              <img
                src={cause.image}
                alt={cause.name}
                className={`${styles.itemImage} card-img-top`}
              />
              <div className="card-body text-center">
                <h5 className="card-title">{cause.name}</h5>
                <p className="card-text">{cause.description}</p>
              </div>
              <div className="card-footer d-flex flex-column align-items-start">
                <div className="d-flex justify-content-between w-100">
                  <span className={styles.itemCost}>{cause.cost} coins</span>
                  <span className={styles.organization}>
                    {cause.donation_organization}
                  </span>
                </div>
                <button
                  className={`btn btn-success mt-2 w-100 ${styles.donateButton}`}
                  onClick={() => handleDonate(cause.id)}
                >
                  Donate
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DonationCauses;
