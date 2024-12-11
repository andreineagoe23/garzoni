import React, { useState } from "react";
import axios from "axios";
import "../styles/SavingsGoalCalculator.css";

const SavingsGoalCalculator = () => {
  const [formData, setFormData] = useState({
    savings_goal: "",
    initial_investment: "",
    years_to_grow: "",
    annual_interest_rate: "",
    compound_frequency: "1", // Default to annually
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    setError(null);

    try {
      const response = await axios.post(
        "http://localhost:8000/api/calculate-savings-goal/",
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );
      setResult(response.data);
    } catch (error) {
      console.error("Error calculating savings goal:", error);
      setError("Failed to calculate. Please check your inputs.");
    }
  };

  return (
    <div className="calculator-container">
      <h3>Savings Goal Calculator</h3>
      <form onSubmit={handleSubmit} className="calculator-form">
        {/* Step 1: Savings Goal */}
        <div className="form-group">
          <label>Savings Goal</label>
          <input
            type="number"
            name="savings_goal"
            placeholder="Desired final savings"
            value={formData.savings_goal}
            onChange={handleChange}
            required
          />
        </div>

        {/* Step 2: Initial Investment */}
        <div className="form-group">
          <label>Initial Investment</label>
          <input
            type="number"
            name="initial_investment"
            placeholder="Amount readily available"
            value={formData.initial_investment}
            onChange={handleChange}
            required
          />
        </div>

        {/* Step 3: Growth Over Time */}
        <div className="form-group">
          <label>Years to Grow</label>
          <input
            type="number"
            name="years_to_grow"
            placeholder="Length of time in years"
            value={formData.years_to_grow}
            onChange={handleChange}
            required
          />
        </div>

        {/* Step 4: Interest Rate */}
        <div className="form-group">
          <label>Estimated Annual Interest Rate (%)</label>
          <input
            type="number"
            name="annual_interest_rate"
            placeholder="Enter percentage"
            value={formData.annual_interest_rate}
            onChange={handleChange}
            required
          />
        </div>

        {/* Step 5: Compound Frequency */}
        <div className="form-group">
          <label>Compound Frequency (times per year)</label>
          <select
            name="compound_frequency"
            value={formData.compound_frequency}
            onChange={handleChange}
          >
            <option value="1">Annually</option>
            <option value="4">Quarterly</option>
            <option value="12">Monthly</option>
            <option value="365">Daily</option>
          </select>
        </div>

        <button type="submit" className="submit-button">
          Calculate
        </button>
      </form>

      {result && (
        <div className="result">
          <p>Final Savings: {result.final_savings}</p>
          {result.message && <p>{result.message}</p>}
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default SavingsGoalCalculator;
