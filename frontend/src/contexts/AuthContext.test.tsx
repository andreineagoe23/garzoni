import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { AuthProvider, useAuth } from "./AuthContext";

const REFRESH_SESSION_KEY = "monevo_has_refresh_session";

const AuthConsumer = () => {
  const { isAuthenticated, isInitialized } = useAuth();
  if (!isInitialized) {
    return <div>Loading</div>;
  }
  return <div>{isAuthenticated ? "Authenticated" : "Anonymous"}</div>;
};

describe("AuthContext refresh flow", () => {
  beforeEach(() => {
    const axiosMock = axios as jest.Mocked<typeof axios>;
    sessionStorage.setItem(REFRESH_SESSION_KEY, "1");
    axiosMock.post.mockResolvedValue({ data: { access: "access-token" } } as any);
    axiosMock.get.mockResolvedValue({
      data: { isAuthenticated: true, user: { username: "tester" } },
    } as any);
  });

  afterEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it("refreshes token and authenticates user on mount", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Authenticated")).toBeInTheDocument();
    });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/token/refresh/"),
      {},
      { withCredentials: true }
    );
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/verify-auth/"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
        }),
      })
    );
  });
});
