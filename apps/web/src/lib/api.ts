import axios, { AxiosError } from "axios";
import type { ApiErrorBody } from "../types";

export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

const TOKEN_KEY = "tahkeem.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401) {
      clearToken();
      // Avoid a redirect loop when the login request itself 401s.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

/** Pull a human (Arabic) message out of an axios error, falling back sensibly. */
export function apiErrorMessage(
  error: unknown,
  fallback = "حدث خطأ غير متوقّع",
): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    const message = body?.message;
    if (Array.isArray(message)) return message.join("، ");
    if (typeof message === "string" && message.trim()) return message;
    if (error.message === "Network Error") {
      return "تعذّر الاتصال بالخادم";
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
