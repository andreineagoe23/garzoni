import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ExercisePage from "./ExercisePage";
import { mockNavigate } from "../../test-utils/react-router-dom-mock";
import i18n from "../../i18n";

type TestG = typeof globalThis & {
  __TEST_LOCATION_SEARCH__?: string;
  __TEST_LOCATION_PATHNAME__?: string;
  __TEST_LOCATION_STATE__?: unknown;
};

const mockHttpGet = jest.fn();

const mockExercisePageTrackEvent = jest.fn();

jest.mock("services/httpClient", () => ({
  __esModule: true,
  default: {
    get: (url: string, config?: unknown) => mockHttpGet(url, config),
    post: jest.fn(),
  },
}));

jest.mock("utils/sound", () => ({
  playFeedbackChime: jest.fn(),
}));

jest.mock("hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    trackEvent: (...args: unknown[]) => mockExercisePageTrackEvent(...args),
  }),
}));

jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    getAccessToken: jest.fn(() => "token"),
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

function setTestLocation(
  search: string,
  pathname = "/exercises",
  state?: unknown
) {
  const g = globalThis as TestG;
  g.__TEST_LOCATION_SEARCH__ = search;
  g.__TEST_LOCATION_PATHNAME__ = pathname;
  if (state === undefined) {
    delete g.__TEST_LOCATION_STATE__;
  } else {
    g.__TEST_LOCATION_STATE__ = state;
  }
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

  afterEach(() => {
    const g = globalThis as TestG;
    delete g.__TEST_LOCATION_SEARCH__;
    delete g.__TEST_LOCATION_PATHNAME__;
    delete g.__TEST_LOCATION_STATE__;
  });

  it("does not request exercises until skill intent is resolved, then uses category filter", async () => {
    setTestLocation("?skill=investing");

    render(<ExercisePage />);

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
    setTestLocation("?skill=Investing", "/exercises", {
      targetSkill: "Budgeting",
    });

    render(<ExercisePage />);

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
    setTestLocation("", "/exercises", { targetSkill: "Basic Finance" });

    render(<ExercisePage />);

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
    setTestLocation("?skill=budgeting");
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

    render(
      <MemoryRouter initialEntries={["/exercises?skill=budgeting"]}>
        <ExercisePage />
      </MemoryRouter>
    );

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
    setTestLocation("?skill=Investing");

    render(<ExercisePage />);

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
