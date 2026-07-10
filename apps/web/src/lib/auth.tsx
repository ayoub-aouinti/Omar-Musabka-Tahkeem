import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, apiErrorMessage, clearToken, getToken, setToken } from "./api";
import type { AuthUser, LoginResponse } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore the session on boot: a stored token means we try `/auth/me`.
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    api
      .get<AuthUser>("/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        clearToken();
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      setToken(res.data.accessToken);
      setUser(res.data.user);
      return res.data.user;
    } catch (error) {
      throw new Error(apiErrorMessage(error, "فشل تسجيل الدخول"));
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.assign("/login");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
