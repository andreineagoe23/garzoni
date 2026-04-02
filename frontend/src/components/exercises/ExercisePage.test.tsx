import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import ExercisePage from "./ExercisePage";
import { mockNavigate } from "../../test-utils/react-router-dom-mock";
import i18n from "../../i18n";

vi.mock("react-router-dom", async (importOriginal) => {
  const { mockNavigate: nav } = await import(
    "../../test-utils/react-router-dom-mock"
  );
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => nav,
  };
});

const mockHttpGet = vi.fn();

const mockExercisePageTrackEvent = vi.fn();

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
    trackEvent: (...args: unknown[]) => mockExercisePageTrackEvent(...args),
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

function renderExercise(
  initial:
    | string
    | { pathname: string; search?: string; state?: unknown }
) {
  const entry =
    typeof initial === "string"
      ? initial
      : {
          pathname: initial.pathname,
          search: initial.search ?? "",
          state: initial.state,
        };
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ExercisePage />
    </MemoryRouter>
  );
}

function getExerciseRequests() {
  return mockHttpGet.mock.calls.filter((c) => c[0] === "/exercises/");
}

describe("ExercisePage skill intent pipeline", () => {
  beforeEach(() => {
    mockHttpGet.mockReset();
    mockNavigate.mockReset();
    mockExercisePageTrackEvent.mockReset();
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

  it("does not request exercises until skill intent is resolved, then uses category filter", async () => {
    renderExercise("/exercises?skill=investing");

    expect(
      screen.getByText(i18n.t("exercises.skillIntent.applyingFocus"))
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Financial Exercises/i })
      ).toBeInTheDocument();
    });

    const exerciseGets = getExerciseRequests();
    expect(exerciseGets.length).toBeGreaterThanOrEqual(1);
    const firstConfig = exerciseGets[0][1] as {
      params: URLSearchParams;
      signal?: AbortSignal;
    };
    expect(firstConfig.params.get("category")).toBe("Investing");

    expect(mockExercisePageTrackEvent).toHaveBeenCalledWith(
      "exercises_page_view",
      expect.objectContaining({
        skill_in_query: "investing",
        intent_source: "query",
      })
    );
    expect(mockExercisePageTrackEvent).toHaveBeenCalledWith(
      "exercise_skill_intent_received",
      expect.objectContaining({ skill: "investing", source: "query" })
    );
    expect(mockExercisePageTrackEvent).toHaveBeenCalledWith(
      "exercise_skill_intent_mapped",
      expect.objectContaining({
        skill: "investing",
        category: "Investing",
        result_count: 1,
        mapped_zero_results: false,
      })
    );
  });

  it("prefers ?skill= over location.state.targetSkill", async () => {
    renderExercise({
      pathname: "/exercises",
      search: "?skill=Investing",
      state: { targetSkill: "Budgeting" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Financial Exercises/i })
      ).toBeInTheDocument();
    });

    const firstConfig = getExerciseRequests()[0][1] as {
      params: URLSearchParams;
    };
    expect(firstConfig.params.get("category")).toBe("Investing");
  });

  it("uses state.targetSkill when query param is absent", async () => {
    renderExercise({
      pathname: "/exercises",
      search: "",
      state: { targetSkill: "Basic Finance" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Financial Exercises/i })
      ).toBeInTheDocument();
    });

    const firstConfig = getExerciseRequests()[0][1] as {
      params: URLSearchParams;
    };
    expect(firstConfig.params.get("category")).toBe("Basic Finance");
  });

  it("emits mapped_zero when mapped category returns no exercises", async () => {
    mockHttpGet.mockImplementation(
      (url: string, config?: { params?: URLSearchParams }) => {
        if (url === "/exercises/categories/") {
          return Promise.resolve({
            data: ["Investing", "Budgeting", "Basic Finance"],
          });
        }
        if (url === "/review-queue/") {
          return Promise.resolve({ data: { due: [], count: 0 } });
        }
        if (url === "/exercises/") {
          const cat = config?.params?.get("category");
          if (cat === "Basic Finance") {
            return Promise.resolve({ data: [] });
          }
          return Promise.resolve({ data: [minimalMcExercise] });
        }
        return Promise.resolve({ data: null });
      }
    );

    renderExercise("/exercises?skill=budgeting");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Financial Exercises/i })
      ).toBeInTheDocument();
    });

    expect(mockExercisePageTrackEvent).toHaveBeenCalledWith(
      "exercise_skill_intent_mapped_zero",
      expect.objectContaining({
        skill: "budgeting",
        category: "Basic Finance",
      })
    );
    expect(mockExercisePageTrackEvent).toHaveBeenCalledWith(
      "exercise_skill_intent_mapped",
      expect.objectContaining({
        mapped_zero_results: true,
        result_count: 0,
      })
    );
  });

  it("manual category change strips skill from URL via navigate", async () => {
    renderExercise("/exercises?skill=Investing");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Financial Exercises/i })
      ).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const selects = screen.getAllByRole("combobox", { hidden: true });
    expect(selects.length).toBeGreaterThanOrEqual(2);
    await user.selectOptions(selects[1], "Budgeting");

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: "/exercises", search: "" },
      expect.objectContaining({ replace: true, state: {} })
    );
  });
});
