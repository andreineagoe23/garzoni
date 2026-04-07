import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const REFRESH_TOKEN_STORAGE_KEY = "garzoni_refresh_token";

const AuthConsumer = () => {
  const { isAuthenticated, isInitialized } = useAuth();
  if (!isInitialized) {
    return <div>Loading</div>;
  }
  return <div>{isAuthenticated ? "Authenticated" : "Anonymous"}</div>;
};

describe("AuthContext refresh flow", () => {
  beforeEach(() => {
    const axiosMock = axios as unknown as {
      post: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
    };
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, "fake-refresh-token");
    axiosMock.post.mockResolvedValue({
      data: { access: "access-token", refresh: "fake-refresh-token" },
    } as { data: { access: string; refresh: string } });
    axiosMock.get.mockResolvedValue({
      data: { isAuthenticated: true, user: { username: "tester" } },
    } as {
      data: { isAuthenticated: boolean; user: { username: string } };
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
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
      { refresh: "fake-refresh-token" },
      expect.objectContaining({ skipAuthRedirect: true })
    );
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/verify-auth/"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Bearer"),
        }),
        skipAuthRedirect: true,
      })
    );
  });
});
