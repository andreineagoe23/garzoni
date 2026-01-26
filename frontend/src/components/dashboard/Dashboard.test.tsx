import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import Dashboard from "./Dashboard";

const mockNavigate = jest.fn();
let mockProfileResponse: {
  is_questionnaire_completed: boolean;
  has_paid?: boolean;
} = {
  is_questionnaire_completed: true,
};
const mockUseQuery = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/all-topics" }),
  }),
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

jest.mock("contexts/AdminContext", () => ({
  useAdmin: () => ({
    adminMode: false,
    toggleAdminMode: jest.fn(),
    canAdminister: false,
  }),
}));

// Translation removed - no mock needed

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useQueryClient: () => ({
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
    }),
  };
});

jest.mock("services/userService", () => ({
  fetchProgressSummary: jest.fn(),
}));

jest.mock("services/httpClient", () => ({
  attachToken: jest.fn(),
}));

jest.mock("./AllTopics", () => ({
  __esModule: true,
  default: ({
    navigationControls,
  }: {
    navigationControls?: React.ReactNode;
  }) => <div>{navigationControls}</div>,
}));

jest.mock("./PersonalizedPath", () => ({
  __esModule: true,
  default: () => null,
}));

describe("Dashboard personalized path CTA", () => {
  beforeAll(() => {
    // JSDOM doesn't implement matchMedia by default.
    if (!window.matchMedia) {
      window.matchMedia = () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      });
    }
  });

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

    fireEvent.click(screen.getByRole("button", { name: /personalizedPath/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/questionnaire");
  });

  it("routes to personalized path when questionnaire is finished", () => {
    // Personalized path access also requires Premium (has_paid)
    mockProfileResponse = { is_questionnaire_completed: true, has_paid: true };

    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: /personalizedPath/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/personalized-path");
  });
});
