import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "contexts/AuthContext";

jest.mock("contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

type MockAuthState = {
  isAuthenticated: boolean;
  isInitialized: boolean;
};

const renderWithAuth = (authState: MockAuthState) => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
  mockUseAuth.mockReturnValue(authState);
  return render(
    <ProtectedRoute>
      <div>Protected Content</div>
    </ProtectedRoute>
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
