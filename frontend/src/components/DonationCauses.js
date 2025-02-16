import React from "react";
import styles from "../styles/RewardsPage.module.css";
import axios from "axios";

// Import images from assets
import EducationFund from "../assets/EducationFund.png";
import CleanWater from "../assets/CleanWater.png";
import WildlifeConservation from "../assets/WildlifeConservation.png";
import DisasterRelief from "../assets/DisasterRelief.png";

function DonationCauses({ onDonate }) {
  const donationCauses = [
    {
      id: 1,
      title: "Education for All",
      description: "Support underprivileged children's education",
      cost: 25,
      image: EducationFund,
      organization: "Global Education Fund",
    },
    {
      id: 2,
      title: "Clean Water Initiative",
      description: "Provide clean water to communities in need",
      cost: 50,
      image: CleanWater,
      organization: "Water for Life",
    },
    {
      id: 3,
      title: "Wildlife Conservation",
      description: "Protect endangered species worldwide",
      cost: 75,
      image: WildlifeConservation,
      organization: "Nature Guardians",
    },
    {
      id: 4,
      title: "Disaster Relief",
      description: "Support communities affected by natural disasters",
      cost: 100,
      image: DisasterRelief,
      organization: "Global Aid Network",
    },
  ];

const handleDonate = async (rewardId) => {
    try {
        const response = await axios.post(
            `${process.env.REACT_APP_BACKEND_URL}/purchases/`,
            { reward_id: rewardId },
            { withCredentials: true }
        );
        if (response.status === 201) {
            alert("Donation successful!");
            onDonate();
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
                alt={cause.title}
                className={`${styles.itemImage} card-img-top`}
              />
              <div className="card-body text-center">
                <h5 className="card-title">{cause.title}</h5>
                <p className="card-text">{cause.description}</p>
              </div>
              <div className="card-footer d-flex flex-column align-items-start">
                <div className="d-flex justify-content-between w-100">
                  <span className={styles.itemCost}>{cause.cost} coins</span>
                  <span className={styles.organization}>
                    {cause.organization}
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
