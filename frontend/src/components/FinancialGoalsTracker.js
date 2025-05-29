import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import {
  Form,
  Button,
  Table,
  Alert,
  Spinner,
  ProgressBar,
  Modal,
} from "react-bootstrap";

function FinancialGoalsTracker() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [newGoal, setNewGoal] = useState({
    goal_name: "",
    target_amount: "",
    deadline: "",
  });
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const { getAccessToken } = useAuth();

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/financial-goals/`,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );
      setGoals(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch goals. Please try again later.");
      console.error("Error fetching goals:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewGoal((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/financial-goals/`,
        newGoal,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );
      setNewGoal({
        goal_name: "",
        target_amount: "",
        deadline: "",
      });
      setShowAddModal(false);
      fetchGoals();
    } catch (err) {
      setError("Failed to add goal");
      console.error(err);
    }
  };

  const handleAddFunds = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/financial-goals/${selectedGoal.id}/add_funds/`,
        { amount: addFundsAmount },
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );
      setAddFundsAmount("");
      setShowAddFundsModal(false);
      fetchGoals();
    } catch (err) {
      setError("Failed to add funds");
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/financial-goals/${id}/`,
        {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        }
      );
      fetchGoals();
    } catch (err) {
      setError("Failed to delete goal");
      console.error(err);
    }
  };

  const getProgressVariant = (percentage) => {
    if (percentage >= 100) return "success";
    if (percentage >= 75) return "info";
    if (percentage >= 50) return "primary";
    if (percentage >= 25) return "warning";
    return "danger";
  };

  if (loading) {
    return (
      <div className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="financial-goals-tracker">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Financial Goals</h2>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          Add New Goal
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="table-responsive">
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Goal Name</th>
              <th>Target Amount</th>
              <th>Current Amount</th>
              <th>Progress</th>
              <th>Deadline</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => (
              <tr key={goal.id}>
                <td>{goal.goal_name}</td>
                <td>${goal.target_amount}</td>
                <td>${goal.current_amount}</td>
                <td>
                  <ProgressBar
                    now={goal.progress_percentage}
                    variant={getProgressVariant(goal.progress_percentage)}
                    label={`${goal.progress_percentage.toFixed(1)}%`}
                  />
                </td>
                <td>
                  {goal.deadline
                    ? `${new Date(goal.deadline).toLocaleDateString()} (${
                        goal.days_remaining
                      } days left)`
                    : "No deadline"}
                </td>
                <td>
                  <Button
                    variant="success"
                    size="sm"
                    className="me-2"
                    onClick={() => {
                      setSelectedGoal(goal);
                      setShowAddFundsModal(true);
                    }}
                  >
                    Add Funds
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(goal.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Add Goal Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Goal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Goal Name</Form.Label>
              <Form.Control
                type="text"
                name="goal_name"
                value={newGoal.goal_name}
                onChange={handleInputChange}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Target Amount</Form.Label>
              <Form.Control
                type="number"
                name="target_amount"
                value={newGoal.target_amount}
                onChange={handleInputChange}
                step="0.01"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Deadline (Optional)</Form.Label>
              <Form.Control
                type="date"
                name="deadline"
                value={newGoal.deadline}
                onChange={handleInputChange}
              />
            </Form.Group>

            <Button variant="primary" type="submit">
              Add Goal
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Add Funds Modal */}
      <Modal
        show={showAddFundsModal}
        onHide={() => setShowAddFundsModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Funds to Goal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAddFunds}>
            <Form.Group className="mb-3">
              <Form.Label>Amount to Add</Form.Label>
              <Form.Control
                type="number"
                value={addFundsAmount}
                onChange={(e) => setAddFundsAmount(e.target.value)}
                step="0.01"
                required
              />
            </Form.Group>

            <Button variant="primary" type="submit">
              Add Funds
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default FinancialGoalsTracker;
