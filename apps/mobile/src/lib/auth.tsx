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
  loginWithCode: (code: string) => Promise<AuthUser>;
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

  const applySession = useCallback(async (data: AuthResponse) => {
    await tokenStore.set(data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Judges authenticate with the single-use credential on their printed card —
   * scanned, or typed when the camera will not read it. There are no passwords
   * on this app; the password endpoint exists for admins on the web dashboard.
   */
  const loginWithCode = useCallback(
    async (code: string) => {
      const { data } = await api.post<AuthResponse>("/auth/code", { code });
      return applySession(data);
    },
    [applySession],
  );

  const loginWithQr = useCallback(
    async (qrToken: string) => {
      const { data } = await api.post<AuthResponse>("/auth/qr", {
        token: qrToken,
      });
      return applySession(data);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      loginWithCode,
      loginWithQr,
      logout,
    }),
    [user, token, isLoading, loginWithCode, loginWithQr, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
