import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ToolsPage from "./ToolsPage";
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

const mockToastError = vi.fn();

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

vi.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    financialProfile: null,
    profile: {
      user_data: { primary_goal: "saving" },
    },
  }),
}));

vi.mock("./toolsRegistry", async () => {
  const ReactMod = await import("react");
  const toolsRegistry = [
    {
      id: "calendar",
      group: "understand-world",
      route: "calendar",
      component: () =>
        ReactMod.createElement("div", null, "Calendar Tool"),
      learnPath: "/all-topics?topic=macro",
      exportable: false,
      keywords: ["calendar"],
    },
    {
      id: "portfolio",
      group: "understand-myself",
      route: "portfolio",
      component: () =>
        ReactMod.createElement("div", null, "Portfolio Tool"),
      learnPath: "/all-topics?topic=investing",
      exportable: true,
      keywords: ["portfolio"],
    },
  ];
  const toolGroups = [
    {
      id: "understand-world",
      image: "https://example.com/world.jpg",
      tools: [toolsRegistry[0]],
    },
    {
      id: "understand-myself",
      image: "https://example.com/myself.jpg",
      tools: [toolsRegistry[1]],
    },
  ];
  const toolByRoute = new Map(toolsRegistry.map((tool) => [tool.route, tool]));
  const TOOL_STORAGE_KEYS = {
    lastTool: "monevo:tools:last-tool",
    sessionId: "monevo:tools:session-id",
    navSource: "monevo:tools:last-source",
  };

  return {
    toolsRegistry,
    toolGroups,
    toolByRoute,
    TOOL_STORAGE_KEYS,
  };
});

describe("ToolsPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockNavigate.mockReset();
    mockToastError.mockReset();
  });

  test("renders the tools landing with tool cards", () => {
    render(
      <MemoryRouter initialEntries={["/tools"]}>
        <Routes>
          <Route path="/tools/*" element={<ToolsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(
      screen.getAllByText(i18n.t("tools.entries.calendar.title")).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18n.t("tools.entries.portfolio.title")).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18n.t("tools.hub.openTool")).length
    ).toBeGreaterThan(0);
  });

  test("redirects unknown tool routes to hub", () => {
    render(
      <MemoryRouter initialEntries={["/tools/unknown"]}>
        <Routes>
          <Route path="/tools/*" element={<ToolsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(mockToastError).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tools", { replace: true });
  });
});
