import React, { useState } from "react";
import axios from "axios";
import "../styles/scss/main.scss";

const SavingsGoalCalculator = () => {
  const [formData, setFormData] = useState({
    savings_goal: "",
    initial_investment: "",
    years_to_grow: "",
    annual_interest_rate: "",
    compound_frequency: "1",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/calculate-savings-goal/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      setResult(response.data);
    } catch (err) {
      console.error("Calculation error:", err);
      setError(err.response?.data?.message || "Failed to calculate. Please check your inputs.");
    }
  };

  return (
    <div className="savings-calculator">
      <h3>Savings Goal Calculator</h3>
      <form onSubmit={handleSubmit} className="calculator-form" noValidate>
        <div className="form-group">
          <label htmlFor="savings_goal">Savings Goal ($)</label>
          <input
            type="number"
            id="savings_goal"
            name="savings_goal"
            placeholder="Desired final savings"
            value={formData.savings_goal}
            onChange={handleChange}
            required
            min="0"
            step="100"
          />
        </div>

        <div className="form-group">
          <label htmlFor="initial_investment">Initial Investment ($)</label>
          <input
            type="number"
            id="initial_investment"
            name="initial_investment"
            placeholder="Amount readily available"
            value={formData.initial_investment}
            onChange={handleChange}
            required
            min="0"
            step="100"
          />
        </div>

        <div className="form-group">
          <label htmlFor="years_to_grow">Years to Grow</label>
          <input
            type="number"
            id="years_to_grow"
            name="years_to_grow"
            placeholder="Length of time in years"
            value={formData.years_to_grow}
            onChange={handleChange}
            required
            min="1"
            max="50"
          />
        </div>

        <div className="form-group">
          <label htmlFor="annual_interest_rate">Annual Interest Rate (%)</label>
          <input
            type="number"
            id="annual_interest_rate"
            name="annual_interest_rate"
            placeholder="Enter percentage"
            value={formData.annual_interest_rate}
            onChange={handleChange}
            required
            min="0"
            max="30"
            step="0.1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="compound_frequency">Compound Frequency</label>
          <select
            id="compound_frequency"
            name="compound_frequency"
            value={formData.compound_frequency}
            onChange={handleChange}
            className="form-select"
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
        <div className="result" role="alert">
          <p>Projected Value: ${result.final_savings?.toLocaleString()}</p>
          {result.message && (
            <p className="text-success">{result.message}</p>
          )}
        </div>
      )}

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default SavingsGoalCalculator;