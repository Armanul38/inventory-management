"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getApiBase = () => {
  let envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    if (envUrl && !envUrl.includes("localhost")) {
      let target = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
      target = target.replace(/\/+$/, "");
      return target.endsWith("/api/v1") ? target : `${target}/api/v1`;
    }
    // Fallback to relative proxy route handled by Next.js rewrites
    return "/api/v1";
  }

  envUrl = envUrl || "http://localhost:8000";
  if (!envUrl.startsWith("http://") && !envUrl.startsWith("https://")) {
    envUrl = `https://${envUrl}`;
  }
  const cleanUrl = envUrl.replace(/\/+$/, "");
  return cleanUrl.endsWith("/api/v1") ? cleanUrl : `${cleanUrl}/api/v1`;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if token exists in localStorage on startup
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      fetchUserInfo(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserInfo = async (authToken: string) => {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth-users/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        // Token is invalid or expired
        logout();
      }
    } catch (err) {
      console.error("Failed to fetch user info", err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email); // OAuth2 expects username
      formData.append("password", password);

      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth-users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Authentication failed");
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      router.push("/dashboard");
    } catch (err) {
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/");
  };

  // Wrapper for authenticated API requests
  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const currentToken = token || localStorage.getItem("token");
    const headers = new Headers(options.headers || {});
    
    if (currentToken) {
      headers.set("Authorization", `Bearer ${currentToken}`);
    }
    
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      logout();
      throw new Error("Session expired. Please log in again.");
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Request failed with status ${res.status}`);
    }

    // Check if response is empty (e.g., status 204 or empty return)
    if (res.status === 204) {
      return null;
    }
    
    return res.json();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
