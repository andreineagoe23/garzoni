import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import Questionnaire from "./Questionnaire";
jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({ getAccessToken: () => "test-access-token" }),
}));
jest.mock("components/common/Loader", () => () => (
  <div>Loading questions...</div>
));

const originalLocation = window.location;

describe("Questionnaire happy path", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          text: "Do you like investing?",
          type: "knowledge_check",
          options: ["Yes", "No"],
        },
      ],
    });

    axios.post.mockResolvedValue({
      data: { success: true, redirect_url: "https://checkout.test/session" },
    });

    delete window.location;
    window.location = { assign: jest.fn() };
  });

  afterEach(() => {
    window.location = originalLocation;
    jest.clearAllMocks();
  });

  it("loads questions, submits answers, and redirects to checkout", async () => {
    render(
      <Questionnaire />
    );

    expect(
      screen.getByText(/Loading questions/i)
    ).toBeInTheDocument();

    await screen.findByText("Do you like investing?");

    await userEvent.click(screen.getByRole("button", { name: "Yes" }));

    await userEvent.click(
      screen.getByRole("button", { name: /Submit Questionnaire/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Redirecting to secure checkout/i)
      ).toBeInTheDocument();
    });

    expect(window.location.assign).toHaveBeenCalledWith(
      "https://checkout.test/session"
    );
  });
});
