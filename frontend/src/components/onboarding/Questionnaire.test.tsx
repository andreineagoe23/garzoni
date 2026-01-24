import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import Questionnaire from "./Questionnaire";
jest.mock("axios");
jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({ getAccessToken: () => "test-access-token" }),
}));
jest.mock("components/common/Loader", () => {
  const LoaderMock = () => <div>Loading questions...</div>;
  LoaderMock.displayName = "Loader";
  return LoaderMock;
});

const originalLocation = window.location;
const axiosMock = axios as unknown as jest.Mocked<typeof axios>;

describe("Questionnaire happy path", () => {
  beforeEach(() => {
    global.__TEST_LOCATION_SEARCH__ = "?plan_id=plus&billing_interval=monthly";
    axiosMock.get.mockResolvedValue({
      data: [
        {
          id: 1,
          text: "Do you like investing?",
          type: "knowledge_check",
          options: ["Yes", "No"],
        },
      ],
    });

    axiosMock.post.mockResolvedValue({
      data: { success: true, redirect_url: "https://checkout.test/session" },
    });

    Object.defineProperty(window, "location", {
      value: { assign: jest.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation as unknown as Location,
      writable: true,
    });
    delete global.__TEST_LOCATION_SEARCH__;
    jest.clearAllMocks();
  });

  it("loads questions, submits answers, and redirects to checkout", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/questionnaire?plan_id=plus&billing_interval=monthly",
        ]}
      >
        <Questionnaire />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading questions/i)).toBeInTheDocument();

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
