import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "contexts/AuthContext";

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid={`mock-navigate-${to}`} />
    ),
  };
});

vi.mock("contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

type MockAuthState = {
  isAuthenticated: boolean;
  isInitialized: boolean;
};

const renderWithAuth = (authState: MockAuthState) => {
  vi.mocked(useAuth).mockReturnValue(authState as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter>
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    </MemoryRouter>
  );
};

describe("ProtectedRoute", () => {
  it("shows loading state while auth initializes", () => {
    renderWithAuth({ isAuthenticated: false, isInitialized: false });
    expect(screen.getByText("Verifying...")).toBeInTheDocument();
  });

  it("redirects to login when unauthenticated", () => {
    renderWithAuth({
      isAuthenticated: false,
      isInitialized: true,
    });
    expect(screen.getByTestId("mock-navigate-/login")).toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    renderWithAuth({ isAuthenticated: true, isInitialized: true });
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
