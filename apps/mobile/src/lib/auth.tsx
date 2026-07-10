import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { AuthResponse, AuthUser, MePayload } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithQr: (token: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeMe(payload: MePayload): AuthUser {
  return {
    id: payload.sub,
    name: payload.name,
    role: payload.role,
    judgeId: payload.judgeId,
    competitionId: payload.competitionId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(async () => {
    await tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  // A 401 from any request clears the session; the router redirects on user===null.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Rehydrate a stored token on cold start.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await tokenStore.get();
        if (stored) {
          const { data } = await api.get<MePayload>("/auth/me");
          if (active) {
            setToken(stored);
            setUser(normalizeMe(data));
          }
        }
      } catch {
        await tokenStore.clear();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<AuthResponse>("/auth/login", {
        email,
        password,
      });
      await tokenStore.set(data.accessToken);
      setToken(data.accessToken);
      setUser(data.user);
    },
    [],
  );

  const loginWithQr = useCallback(async (qrToken: string) => {
    const { data } = await api.post<AuthResponse>("/auth/qr", {
      token: qrToken,
    });
    await tokenStore.set(data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      loginWithPassword,
      loginWithQr,
      logout,
    }),
    [user, token, isLoading, loginWithPassword, loginWithQr, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
