import React from "react";
import { render } from "@testing-library/react";
import { act } from "react";
import App from "./App";

jest.mock("services/analyticsService", () => ({
  recordFunnelEvent: jest.fn(() => Promise.resolve()),
}));

const consoleError = jest
  .spyOn(console, "error")
  .mockImplementation(() => undefined);

afterAll(() => {
  consoleError.mockRestore();
});

test("renders without crashing", async () => {
  let view;
  await act(async () => {
    view = render(<App />);
  });

  expect(view.container).toBeTruthy();
});

test("test harness runs", () => {
  expect(true).toBe(true);
});
