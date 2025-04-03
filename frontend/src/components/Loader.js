// components/Loader.js
import React from 'react';

const Loader = ({ message = "Loading..." }) => (
  <div className="loader-container text-center py-5">
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <p className="mt-3 text-muted">{message}</p>
  </div>
);

export default Loader;