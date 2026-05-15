"use client";
import { useState, useEffect, useCallback } from "react";

export interface AuthState {
  status: "loading" | "authenticated" | "unauthenticated" | "not_configured";
  username?: string;
  userId?: string;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status");
      const json = await res.json();
      setAuth(
        json.authenticated
          ? { status: "authenticated", username: json.username, userId: json.userId }
          : { status: "unauthenticated" }
      );
    } catch {
      setAuth({ status: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    // Handle OAuth callback result in URL
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get("auth");
    if (authResult === "not_configured") {
      setAuth({ status: "not_configured" });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (authResult) {
      // Clean the URL params, then verify auth status
      window.history.replaceState({}, "", window.location.pathname);
    }
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((targetUsername?: string) => {
    const params = new URLSearchParams();
    if (targetUsername) params.set("target", targetUsername);
    window.location.href = `/api/auth/instagram?${params}`;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth({ status: "unauthenticated" });
  }, []);

  const isAuthenticated = auth.status === "authenticated";
  const isLoading = auth.status === "loading";

  return { auth, isAuthenticated, isLoading, login, logout, checkAuth };
}
