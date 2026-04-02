import React from "react";
import { render } from "@testing-library/react";
import { afterAll, test, expect, vi } from "vitest";
import App from "./App";

vi.mock("services/analyticsService", () => ({
  recordFunnelEvent: () => Promise.resolve(),
}));

const consoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => undefined);

afterAll(() => {
  consoleError.mockRestore();
});

test("renders without crashing", () => {
  const view = render(<App />);

  expect(view.container).toBeTruthy();
});

test("harness runs", () => {
  expect(true).toBe(true);
});
