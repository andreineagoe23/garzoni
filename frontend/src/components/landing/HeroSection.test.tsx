import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import i18n from "../../test-utils/i18n-for-tests";
import HeroSection from "./HeroSection";

// Avoid rendering the heavy Three.js particle scene in tests
vi.mock("./ParticleStage", () => ({
  default: () => <div data-testid="particle-stage" />,
}));

vi.mock("services/backendUrl", () => ({
  BACKEND_URL: "http://localhost:8000/api",
  getBackendUrl: () => "http://localhost:8000/api",
  getMediaBaseUrl: () => "http://localhost:8000",
}));

describe("HeroSection demo modal", () => {
  const renderHero = () =>
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <HeroSection scrollToFeatures={vi.fn()} />
        </MemoryRouter>
      </I18nextProvider>
    );

  it("renders a hidden preloading video for the demo", () => {
    renderHero();
    const preloadVideo = screen.getByTestId("hero-demo-preload-video");
    expect(preloadVideo).toHaveAttribute(
      "src",
      "http://localhost:8000/media/welcome/garzoni-demo.mp4"
    );
  });
});
