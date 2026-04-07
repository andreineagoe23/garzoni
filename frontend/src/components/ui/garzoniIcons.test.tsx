import React from "react";
import { render, screen } from "@testing-library/react";
import { GarzoniIcon } from "./garzoniIcons";

describe("GarzoniIcon", () => {
  it("renders an svg for a known icon key", () => {
    render(<GarzoniIcon name="target" />);
    expect(screen.getByTestId("garzoni-icon")).toBeInTheDocument();
  });

  it("resolves an emoji input to a known icon", () => {
    render(<GarzoniIcon name="🎯" />);
    expect(screen.getByTestId("garzoni-icon")).toBeInTheDocument();
  });

  it("renders nothing for an unknown icon input", () => {
    render(<GarzoniIcon name="not-a-real-icon" />);
    expect(screen.queryByTestId("garzoni-icon")).not.toBeInTheDocument();
  });
});
