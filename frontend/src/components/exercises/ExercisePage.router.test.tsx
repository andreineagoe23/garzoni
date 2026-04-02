/**
 * Deep-link / refresh simulation: real router initial URL with ?skill=
 */
import React from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ExercisePage from "./ExercisePage";
import i18n from "../../i18n";

const mockHttpGet = vi.fn();

const mockExerciseRouterTrackEvent = vi.fn();

vi.mock("services/httpClient", () => ({
  __esModule: true,
  default: {
    get: (url: string, config?: unknown) => mockHttpGet(url, config),
    post: vi.fn(),
  },
}));

vi.mock("utils/sound", () => ({
  playFeedbackChime: vi.fn(),
}));

vi.mock("hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    trackEvent: (...args: unknown[]) => mockExerciseRouterTrackEvent(...args),
  }),
}));

vi.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    getAccessToken: () => "token",
    isInitialized: true,
    isAuthenticated: true,
    entitlements: { features: { hints: { enabled: true } } },
    settings: { sound_enabled: false, animations_enabled: false },
  }),
}));

const minimalMcExercise = {
  id: 1,
  question: "Pick one",
  type: "multiple-choice",
  exercise_data: { options: ["A", "B"] },
};

function getExerciseRequests() {
  return mockHttpGet.mock.calls.filter((c) => c[0] === "/exercises/");
}

describe("ExercisePage router deep link", () => {
  beforeEach(() => {
    mockHttpGet.mockReset();
    mockExerciseRouterTrackEvent.mockReset();
    mockHttpGet.mockImplementation((url: string) => {
      if (url === "/exercises/categories/") {
        return Promise.resolve({
          data: ["Investing", "Budgeting", "Basic Finance"],
        });
      }
      if (url === "/review-queue/") {
        return Promise.resolve({ data: { due: [], count: 0 } });
      }
      if (url === "/exercises/") {
        return Promise.resolve({ data: [minimalMcExercise] });
      }
      return Promise.resolve({ data: null });
    });
  });

  it("mounts on /exercises?skill=Budgeting, resolves category, then fetches with explicit map (Basic Finance)", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/exercises",
          element: (
            <I18nextProvider i18n={i18n}>
              <ExercisePage />
            </I18nextProvider>
          ),
        },
      ],
      { initialEntries: ["/exercises?skill=Budgeting"] }
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Financial Exercises/i })
      ).toBeInTheDocument();
    });

    const exerciseGets = getExerciseRequests();
    expect(exerciseGets.length).toBeGreaterThanOrEqual(1);
    const firstConfig = exerciseGets[0][1] as {
      params: URLSearchParams;
    };
    expect(firstConfig.params.get("category")).toBe("Basic Finance");

    expect(mockExerciseRouterTrackEvent).toHaveBeenCalledWith(
      "exercises_page_view",
      expect.objectContaining({
        skill_in_query: "Budgeting",
        intent_source: "query",
        dashboard_entry_surface: "skill_query_only",
      })
    );
  });
});
