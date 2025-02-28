import React, { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "react-bootstrap";

const FriendRequests = () => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/friend-requests/`,
          { withCredentials: true }
        );
        setRequests(response.data);
      } catch (err) {
        console.error("Error fetching requests:", err);
      }
    };
    fetchRequests();
  }, []);

  const handleAccept = async (requestId) => {
    try {
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/friend-requests/${requestId}/`,
        { action: "accept" }, // Send action in request body
        { withCredentials: true }
      );
      setRequests(requests.filter((request) => request.id !== requestId));
      alert("Friend request accepted!");
    } catch (err) {
      console.error("Error accepting request:", err);
      alert(
        "Error accepting request: " + (err.response?.data?.error || err.message)
      );
    }
  };

  const handleReject = async (requestId) => {
    try {
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/friend-requests/${requestId}/`,
        { action: "reject" }, // Send action in request body
        { withCredentials: true }
      );
      setRequests(requests.filter((request) => request.id !== requestId));
      alert("Friend request rejected.");
    } catch (err) {
      console.error("Error rejecting request:", err);
      alert(
        "Error rejecting request: " + (err.response?.data?.error || err.message)
      );
    }
  };

  return (
    <div className="friend-requests mt-4">
      <h3>Pending Friend Requests</h3>
      {requests.length === 0 ? (
        <p>No pending friend requests.</p>
      ) : (
        requests.map((request) => (
          <div
            key={request.id}
            className="request-item mb-3 p-3 border rounded"
          >
            <p>
              <strong>{request.sender.username}</strong> wants to be your
              friend.
            </p>
            <div className="d-flex gap-2">
              <Button
                variant="success"
                onClick={() => handleAccept(request.id)}
              >
                Accept
              </Button>
              <Button variant="danger" onClick={() => handleReject(request.id)}>
                Reject
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default FriendRequests;
