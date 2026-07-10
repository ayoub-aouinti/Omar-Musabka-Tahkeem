import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ACCESS_CODE_LENGTH,
  isAccessCodeShaped,
  normalizeAccessCode,
} from "@tahkeem/shared";
import { apiErrorMessage } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, MIN_TOUCH, radius, spacing } from "../src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginWithCode } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Judges hold a printed card; there are no passwords on this app.
  const canSubmit = isAccessCodeShaped(code) && !submitting;

  const onChangeCode = (next: string) => {
    setError(null);
    // Re-group as ABCD-EFGH while typing, and stop at the code's length.
    const clean = normalizeAccessCode(next).slice(0, ACCESS_CODE_LENGTH);
    setCode(clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean);
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await loginWithCode(code);
      // The auth gate redirects once the user is set.
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../assets/logo-omar.png")}
          style={styles.logo}
          accessibilityLabel="شعار جمعية عمر بن الخطاب"
          resizeMode="cover"
        />
        <Text style={styles.title}>المحكّم القرآني</Text>
        <Text style={styles.subtitle}>منصّة تحكيم المسابقات القرآنية</Text>

        <Pressable
          onPress={() => router.push("/scan")}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.scanButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>مسح بطاقة تعريف المحكّم</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>أو أدخل رمز التحقّق</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>رمز التحقّق</Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={onChangeCode}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            // The code is ASCII: force the Latin keyboard even under an RTL UI.
            textAlign="center"
            placeholder="ABCD-EFGH"
            placeholderTextColor={colors.outline}
            onSubmitEditing={onSubmit}
            returnKeyType="go"
            maxLength={ACCESS_CODE_LENGTH + 1}
            accessibilityLabel="رمز التحقّق المكوّن من ثمانية أحرف"
          />
          <Text style={styles.hint}>
            الرمز مطبوع على بطاقة المحكّم تحت رمز QR
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.outlinedButton,
              pressed && canSubmit && styles.outlinedButtonPressed,
              !canSubmit && styles.buttonDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.outlinedButtonText}>دخول</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    alignItems: "stretch",
  },
  logo: {
    alignSelf: "center",
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  form: { gap: spacing.sm },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
    textAlign: "right",
    marginTop: spacing.sm,
  },
  scanButton: { marginTop: spacing.md },
  codeInput: {
    minHeight: MIN_TOUCH + 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 26,
    letterSpacing: 4,
    fontWeight: "700",
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
    // The code is Latin/ASCII; keep it LTR inside the RTL layout.
    writingDirection: "ltr",
  },
  hint: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  error: {
    color: colors.error,
    backgroundColor: colors.errorContainer,
    borderRadius: radius.sm,
    padding: spacing.md,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  primaryButton: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  primaryButtonPressed: { backgroundColor: colors.primaryContainer },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  buttonDisabled: { opacity: 0.5 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerText: { color: colors.onSurfaceVariant, fontSize: 14 },
  outlinedButton: {
    minHeight: MIN_TOUCH + 8,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  outlinedButtonPressed: { backgroundColor: colors.primaryFixed },
  outlinedButtonText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
  },
});
