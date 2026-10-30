import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    organization?: string;
  }) => Promise<void>;
  logout: () => void;
  quickSwitchDemo: (role: "admin" | "reporter") => Promise<void>;
  isAdmin: boolean;
  isReporter: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("emergency_token"));
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    const currentToken = localStorage.getItem("emergency_token");
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch {
      // If token expired or invalid, clear it
      localStorage.removeItem("emergency_token");
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      localStorage.setItem("emergency_token", res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    organization?: string;
  }) => {
    setLoading(true);
    try {
      const res = await api.register(data);
      localStorage.setItem("emergency_token", res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("emergency_token");
    setToken(null);
    setUser(null);
  };

  const quickSwitchDemo = async (role: "admin" | "reporter") => {
    if (role === "admin") {
      await login("admin@emergency.gov", "Admin@1234");
    } else {
      await login("reporter@emergency.gov", "Reporter@1234");
    }
  };

  const isAdmin = user?.role === "admin";
  const isReporter = user?.role === "reporter" || user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        quickSwitchDemo,
        isAdmin,
        isReporter,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
