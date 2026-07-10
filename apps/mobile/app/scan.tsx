import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { apiErrorMessage } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, MIN_TOUCH, radius, spacing } from "../src/theme";

const RETICLE = 260;

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginWithQr } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanY]);

  const onScanned = async (result: BarcodeScanningResult) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      // The QR encodes the raw token string — send it verbatim.
      await loginWithQr(result.data);
      router.replace("/");
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  };

  const retry = () => {
    setError(null);
    locked.current = false;
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.permTitle}>الكاميرا مطلوبة</Text>
        <Text style={styles.permBody}>
          نحتاج إلى إذن الكاميرا لمسح بطاقة تعريف المحكّم. يمكنك منح الإذن الآن أو
          من إعدادات التطبيق.
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>السماح باستخدام الكاميرا</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={() => void Linking.openSettings()}
          >
            <Text style={styles.primaryButtonText}>فتح الإعدادات</Text>
          </Pressable>
        )}
        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkButtonText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={locked.current ? undefined : onScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.reticle}>
          <Corner style={styles.tl} />
          <Corner style={styles.tr} />
          <Corner style={styles.bl} />
          <Corner style={styles.br} />
          {!error && !busy ? (
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, RETICLE - 12],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
        </View>

        <Text style={styles.guidance}>
          وجّه الكاميرا نحو رمز QR على بطاقة المحكّم
        </Text>

        {busy ? (
          <View style={styles.statusPill}>
            <ActivityIndicator color={colors.onPrimary} />
            <Text style={styles.statusText}>جارٍ التحقّق…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={retry}>
              <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <Pressable
        style={[styles.closeButton, { top: insets.top + spacing.md }]}
        onPress={() => router.back()}
        accessibilityLabel="إغلاق"
      >
        <Text style={styles.closeGlyph}>✕</Text>
      </Pressable>
    </View>
  );
}

function Corner({ style }: { style: object }) {
  return <View style={[styles.corner, style]} />;
}

const BRACKET = 36;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  reticle: {
    width: RETICLE,
    height: RETICLE,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: BRACKET,
    height: BRACKET,
    borderColor: colors.primaryFixed,
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: radius.lg },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: radius.lg },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: radius.lg },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: radius.lg },
  scanLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: colors.primaryFixed,
    shadowColor: colors.primaryFixed,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  guidance: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    writingDirection: "rtl",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
  },
  statusText: { color: colors.onPrimary, fontSize: 15, fontWeight: "700" },
  errorCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "stretch",
    gap: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    writingDirection: "rtl",
  },
  retryButton: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
  closeButton: {
    position: "absolute",
    right: spacing.lg,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeGlyph: { color: "#fff", fontSize: 20, fontWeight: "700" },
  permission: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  permTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "center",
  },
  permBody: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    writingDirection: "rtl",
  },
  primaryButton: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  primaryButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
  linkButton: {
    minHeight: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  linkButtonText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
});
