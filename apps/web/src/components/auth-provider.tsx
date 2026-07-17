"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ApiError, authApi, clearStoredToken, getStoredToken, storeToken } from "@/lib/api";
import type { User } from "@/lib/types";

type LoginPayload = { username: string; password: string };
type RegisterPayload = LoginPayload & {
  email: string;
  display_name: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const nextUser = await authApi.me(token);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredToken();
        setUser(null);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      Promise.resolve().then(() => {
        setUser(null);
        setLoading(false);
      });
      return;
    }

    authApi
      .me(token)
      .then(setUser)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) clearStoredToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function finishAuthentication(accessToken: string) {
    storeToken(accessToken);
    try {
      const nextUser = await authApi.me(accessToken);
      setUser(nextUser);
      return nextUser;
    } catch (error) {
      clearStoredToken();
      throw error;
    }
  }

  async function login(payload: LoginPayload) {
    const token = await authApi.login(payload);
    return finishAuthentication(token.access_token);
  }

  async function register(payload: RegisterPayload) {
    const token = await authApi.register(payload);
    return finishAuthentication(token.access_token);
  }

  function logout() {
    clearStoredToken();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
