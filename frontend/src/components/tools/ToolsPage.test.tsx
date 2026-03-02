import React from "react";
import { render, screen } from "@testing-library/react";
import ToolsPage from "./ToolsPage";
import { mockNavigate } from "../../test-utils/react-router-dom-mock";
import i18n from "../../i18n";

const mockToastError = jest.fn();

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: jest.fn(),
  },
}));

jest.mock("contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    financialProfile: null,
    profile: {
      user_data: { primary_goal: "saving" },
    },
  }),
}));

jest.mock("./toolsRegistry", () => {
  const React = require("react");
  const toolsRegistry = [
    {
      id: "calendar",
      group: "understand-world",
      route: "calendar",
      component: () => React.createElement("div", null, "Calendar Tool"),
      learnPath: "/all-topics?topic=macro",
      exportable: false,
      keywords: ["calendar"],
    },
    {
      id: "portfolio",
      group: "understand-myself",
      route: "portfolio",
      component: () => React.createElement("div", null, "Portfolio Tool"),
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
    (
      globalThis as typeof globalThis & { __TEST_LOCATION_PATHNAME__?: string }
    ).__TEST_LOCATION_PATHNAME__ = "/tools";
  });

  test("renders the tools landing with tool cards", () => {
    render(<ToolsPage />);
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
    (
      globalThis as typeof globalThis & { __TEST_LOCATION_PATHNAME__?: string }
    ).__TEST_LOCATION_PATHNAME__ = "/tools/unknown";
    render(<ToolsPage />);
    expect(mockToastError).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tools", { replace: true });
  });
});
