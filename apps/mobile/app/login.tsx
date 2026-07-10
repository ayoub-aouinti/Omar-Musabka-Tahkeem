import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { apiErrorMessage } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { colors, MIN_TOUCH, radius, spacing } from "../src/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginWithPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
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
        <View style={styles.logo}>
          <Text style={styles.logoGlyph}>۩</Text>
        </View>
        <Text style={styles.title}>المحكّم القرآني</Text>
        <Text style={styles.subtitle}>منصّة تحكيم المسابقات القرآنية</Text>

        <View style={styles.form}>
          <Text style={styles.label}>البريد الإلكتروني</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textAlign="right"
            placeholder="name@example.com"
            placeholderTextColor={colors.outline}
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textAlign="right"
            placeholder="••••••••"
            placeholderTextColor={colors.outline}
            onSubmitEditing={onSubmit}
            returnKeyType="go"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && canSubmit && styles.primaryButtonPressed,
              !canSubmit && styles.buttonDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>تسجيل الدخول</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>أو وصول سريع</Text>
          <View style={styles.divider} />
        </View>

        <Pressable
          onPress={() => router.push("/scan")}
          style={({ pressed }) => [
            styles.outlinedButton,
            pressed && styles.outlinedButtonPressed,
          ]}
        >
          <Text style={styles.outlinedButtonText}>مسح بطاقة تعريف المحكّم</Text>
        </Pressable>
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
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  logoGlyph: { fontSize: 52, color: colors.onPrimary },
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
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
    writingDirection: "rtl",
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
