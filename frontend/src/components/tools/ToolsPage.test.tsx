import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import ToolsPage from "./ToolsPage";
import { mockNavigate } from "../../test-utils/react-router-dom-mock";
import i18n from "../../i18n";

vi.mock("react-router-dom", async (importOriginal) => {
  const { mockNavigate: nav } =
    await import("../../test-utils/react-router-dom-mock");
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
      id: "next-steps",
      group: "decide-next",
      route: "next-steps",
      component: () =>
        ReactMod.createElement("div", null, "Next Steps Tool Body"),
      learnPath: "/all-topics?topic=planning",
      exportable: false,
      keywords: ["next"],
    },
    {
      id: "calendar",
      group: "understand-world",
      route: "calendar",
      component: () => ReactMod.createElement("div", null, "Calendar Tool"),
      learnPath: "/all-topics?topic=macro",
      exportable: false,
      keywords: ["calendar"],
    },
    {
      id: "portfolio",
      group: "understand-myself",
      route: "portfolio",
      component: () => ReactMod.createElement("div", null, "Portfolio Tool"),
      learnPath: "/all-topics?topic=investing",
      exportable: true,
      keywords: ["portfolio"],
    },
  ];
  const toolGroups = [
    {
      id: "decide-next",
      image: "https://example.com/decide.jpg",
      tools: [toolsRegistry[0]],
    },
    {
      id: "understand-world",
      image: "https://example.com/world.jpg",
      tools: [toolsRegistry[1]],
    },
    {
      id: "understand-myself",
      image: "https://example.com/myself.jpg",
      tools: [toolsRegistry[2]],
    },
  ];
  const toolByRoute = new Map(toolsRegistry.map((tool) => [tool.route, tool]));
  const TOOL_STORAGE_KEYS = {
    lastTool: "garzoni:tools:last-tool",
    sessionId: "garzoni:tools:session-id",
    navSource: "garzoni:tools:last-source",
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

  test("redirects /tools to the default tool route", async () => {
    render(
      <MemoryRouter initialEntries={["/tools"]}>
        <Routes>
          <Route path="/tools/*" element={<ToolsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText("Next Steps Tool Body")).toBeInTheDocument();
    });
  });

  test("renders a specific tool when the route is set", () => {
    render(
      <MemoryRouter initialEntries={["/tools/portfolio"]}>
        <Routes>
          <Route path="/tools/*" element={<ToolsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Portfolio Tool")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: i18n.t("tools.workspace.actionAriaFeedback"),
      })
    ).toBeInTheDocument();
  });

  test("redirects unknown tool routes to the default tool", async () => {
    render(
      <MemoryRouter initialEntries={["/tools/unknown"]}>
        <Routes>
          <Route path="/tools/*" element={<ToolsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(mockToastError).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/tools/next-steps", {
        replace: true,
      });
    });
  });
});
