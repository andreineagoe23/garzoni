import React from "react";
import styles from "../styles/SectionProgress.module.css";

// SectionProgress.js
const SectionProgress = ({ total, current }) => {
  const progressSteps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className={styles.progressContainer}>
      {progressSteps.map((step) => (
        <div 
          key={step}
          className={`${styles.progressStep} ${
            step <= current ? styles.active : ""
          }`}
        >
          <div className={styles.stepIndicator}>
            {step <= current ? "✓" : step}
          </div>
          {step === current && <div className={styles.currentMarker} />}
        </div>
      ))}
    </div>
  );
};

export default SectionProgress;