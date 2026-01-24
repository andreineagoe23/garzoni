import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "contexts/AuthContext";
import i18n from "i18n";

jest.mock("contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const renderWithAuth = (authState: any) => {
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
    expect(
      screen.getByText(i18n.t("protectedRoute.verifying", { ns: "auth" }))
    ).toBeInTheDocument();
  });

  it("redirects to login when unauthenticated", () => {
    const { container } = renderWithAuth({
      isAuthenticated: false,
      isInitialized: true,
    });
    expect(container.querySelector('[data-mock-navigate="/login"]')).not.toBeNull();
  });

  it("renders children when authenticated", () => {
    renderWithAuth({ isAuthenticated: true, isInitialized: true });
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
