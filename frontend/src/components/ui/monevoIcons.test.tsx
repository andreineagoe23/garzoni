import React from "react";
import { render, screen } from "@testing-library/react";
import { MonevoIcon } from "./monevoIcons";

describe("MonevoIcon", () => {
  it("renders an svg for a known icon key", () => {
    render(<MonevoIcon name="target" />);
    expect(screen.getByTestId("monevo-icon")).toBeInTheDocument();
  });

  it("resolves an emoji input to a known icon", () => {
    render(<MonevoIcon name="🎯" />);
    expect(screen.getByTestId("monevo-icon")).toBeInTheDocument();
  });

  it("renders nothing for an unknown icon input", () => {
    render(<MonevoIcon name="not-a-real-icon" />);
    expect(screen.queryByTestId("monevo-icon")).not.toBeInTheDocument();
  });
});
