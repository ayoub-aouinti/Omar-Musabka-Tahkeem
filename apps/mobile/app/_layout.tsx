import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { ActivityIndicator, I18nManager, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { queryClient } from "../src/lib/queryClient";
import { colors } from "../src/theme";

// `I18nManager.forceRTL(true)` only takes effect after a *native* reload, so on
// first launch (and always, in Expo Go) the app would lay out left-to-right —
// which is exactly what happened. Allow RTL for native components, then set the
// direction explicitly on the root view below: Yoga applies it on the first
// render, no restart, no half-mirrored screens.
I18nManager.allowRTL(true);

void SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const first = segments[0];
    const onAuthScreen = first === "login" || first === "scan";
    if (!user && !onAuthScreen) {
      router.replace("/login");
    } else if (user && first === "login") {
      router.replace("/");
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="scan" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="judge/[candidateId]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    UthmanicQaloun: require("../assets/fonts/uthmanic_qaloun_v21.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BottomSheetModalProvider>
              <StatusBar style="dark" />
              <AuthGate />
            </BottomSheetModalProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Every descendant lays out right-to-left, so `flexDirection: "row"` already
  // runs right→left. Never write `row-reverse` under this root: it flips back.
  root: { flex: 1, backgroundColor: colors.background, direction: "rtl" },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
