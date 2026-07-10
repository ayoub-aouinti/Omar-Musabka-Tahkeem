/**
 * Minimal typing for the `process.env` access Expo statically inlines at build
 * time. Only `EXPO_PUBLIC_*` variables are exposed to the client bundle.
 * Declared here so we don't pull all of `@types/node`'s globals into React Native.
 */
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};
