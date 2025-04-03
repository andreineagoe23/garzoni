// PaymentRequired.js
import React from 'react';
import { Link } from 'react-router-dom';

const PaymentRequired = () => (
  <div className="container text-center py-5">
    <h2 className="mb-4">Payment Required 🔒</h2>
    <p className="lead mb-4">
      You need to complete the payment to access this content.
    </p>
    <Link to="/questionnaire" className="btn btn-primary">
      Return to Questionnaire
    </Link>
  </div>
);

export default PaymentRequired;