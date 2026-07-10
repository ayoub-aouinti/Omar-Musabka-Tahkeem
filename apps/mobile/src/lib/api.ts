import axios, { AxiosError, type AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";

const TOKEN_KEY = "tahkeem.accessToken";

/** SecureStore-backed token persistence. */
export const tokenStore = {
  get: (): Promise<string | null> => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string): Promise<void> =>
    SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: (): Promise<void> => SecureStore.deleteItemAsync(TOKEN_KEY),
};

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// The auth layer registers a callback here so a 401 anywhere can bounce the user
// back to /login without api.ts having to import the router or the context.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

api.interceptors.request.use(async (config) => {
  const token = await tokenStore.get();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await tokenStore.clear();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

interface ApiErrorBody {
  message?: string | string[];
}

/** Pull the Arabic `message` the API returns, falling back to a generic line. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined;
    const message = data?.message;
    if (Array.isArray(message) && message.length > 0) return message[0];
    if (typeof message === "string" && message.length > 0) return message;
    if (error.code === "ECONNABORTED") return "انتهت مهلة الاتصال بالخادم";
    if (!error.response) return "تعذّر الاتصال بالخادم. تحقّق من الشبكة";
  }
  return "حدث خطأ غير متوقّع";
}
