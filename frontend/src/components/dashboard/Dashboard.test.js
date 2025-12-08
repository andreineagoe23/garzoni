import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

var mockNavigate;
var mockProfileResponse = { is_questionnaire_completed: true };
var mockUseQuery = jest.fn();

jest.mock(
  "react-router-dom",
  () => {
    mockNavigate = jest.fn();
    return {
      useNavigate: () => mockNavigate,
      useLocation: () => ({ pathname: "/all-topics" }),
    };
  },
  { virtual: true }
);

jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    getAccessToken: jest.fn(() => "token"),
    user: { first_name: "Alex" },
    loadProfile: jest.fn(),
    profile: null,
  }),
}));

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => ({
  __esModule: true,
  useQuery: (...args) => mockUseQuery(...args),
}));

jest.mock("services/userService", () => ({
  fetchProgressSummary: jest.fn(),
}));

jest.mock("services/httpClient", () => ({
  attachToken: jest.fn(),
}));

jest.mock("./AllTopics", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./PersonalizedPath", () => ({
  __esModule: true,
  default: () => null,
}));

const Dashboard = require("./Dashboard").default;

describe("Dashboard personalized path CTA", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseQuery.mockImplementation(({ queryKey }) => {
      if (queryKey?.[0] === "profile") {
        return { data: mockProfileResponse, isLoading: false };
      }

      return {
        data: { data: { overall_progress: 0, paths: [] } },
        isLoading: false,
      };
    });
  });

  it("routes to questionnaire when personalization is incomplete", () => {
    mockProfileResponse = { is_questionnaire_completed: false };

    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: /personalized path/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/questionnaire");
  });

  it("routes to personalized path when questionnaire is finished", () => {
    mockProfileResponse = { is_questionnaire_completed: true };

    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: /personalized path/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/personalized-path");
  });
});
