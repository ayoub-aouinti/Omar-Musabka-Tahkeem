import axios, { AxiosError, type AxiosInstance } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/** Port the API listens on. Keep in sync with `apps/api/.env`. */
const API_PORT = 3001;

/**
 * Where the API lives.
 *
 * `localhost` on a physical device means the *phone*, not the laptop, so a
 * hardcoded default can never work over Wi-Fi. Expo already tells us the machine
 * that served the bundle (`hostUri` is e.g. "172.20.10.2:8081"), so reuse its
 * host and swap the port. An explicit `EXPO_PUBLIC_API_URL` always wins, which
 * is what a staging or production build sets.
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Older/other manifest shapes still carry the debugger host.
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;

  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:${API_PORT}/api`;

  // Simulator/emulator, where localhost really is the host machine.
  return `http://localhost:${API_PORT}/api`;
}

export const API_URL = resolveApiUrl();

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
