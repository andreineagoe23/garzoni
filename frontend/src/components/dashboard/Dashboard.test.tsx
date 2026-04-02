import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import Dashboard from "./Dashboard";

const mockNavigate = vi.fn();
let mockProfileResponse: {
  is_questionnaire_completed: boolean;
  has_paid?: boolean;
} = {
  is_questionnaire_completed: true,
};
const mockUseQuery = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      pathname: "/all-topics",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
  };
});

vi.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    getAccessToken: vi.fn(() => "token"),
    user: { first_name: "Alex" },
    loadProfile: vi.fn(),
    profile: null,
  }),
}));

vi.mock("contexts/AdminContext", () => ({
  useAdmin: () => ({
    adminMode: false,
    toggleAdminMode: vi.fn(),
    canAdminister: false,
  }),
}));

vi.mock("axios", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useQueryClient: () => ({
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("services/userService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("services/userService")>();
  return {
    ...actual,
    fetchProgressSummary: vi.fn(),
  };
});

vi.mock("services/httpClient", () => ({
  attachToken: vi.fn(),
}));

vi.mock("./AllTopics", () => ({
  __esModule: true,
  default: ({
    navigationControls,
  }: {
    navigationControls?: React.ReactNode;
  }) => <div>{navigationControls}</div>,
}));

vi.mock("./PersonalizedPathContent", () => ({
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
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });
    }
  });

  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseQuery.mockImplementation(({ queryKey }) => {
      if (queryKey?.[0] === "profile") {
        return { data: mockProfileResponse, isLoading: false };
      }
      if (queryKey?.[0] === "questionnaire-progress") {
        return {
          data: { status: "completed" },
          isLoading: false,
          isFetching: false,
          isFetched: true,
        };
      }

      return {
        data: { data: { overall_progress: 0, paths: [] } },
        isLoading: false,
      };
    });
  });

  it("routes to onboarding when personalization is incomplete", () => {
    mockProfileResponse = { is_questionnaire_completed: false };

    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: /personalized path/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
  });

  it("routes to personalized path when onboarding is finished", () => {
    // Personalized path access also requires Premium (has_paid)
    mockProfileResponse = { is_questionnaire_completed: true, has_paid: true };

    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: /personalized path/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/personalized-path");
  });
});
