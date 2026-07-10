import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/lib/auth";
import { useCountdown } from "../../src/lib/useElapsed";
import { formatClock } from "../../src/lib/format";
import { colors, MIN_TOUCH, radius, spacing } from "../../src/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const remaining = useCountdown(user?.expiresAt);

  const confirmLogout = () => {
    Alert.alert(
      "تسجيل الخروج",
      "هل تريد تسجيل الخروج من حساب المحكّم؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: () => void logout(),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <Text style={styles.title}>الإعدادات</Text>

      <View style={styles.card}>
        <Row label="اسم المحكّم" value={user?.name ?? "—"} />
        <Divider />
        <Row
          label="المسابقة المرتبطة"
          value={user?.competitionId ? user.competitionId : "غير محدّدة"}
        />
        {user?.expiresAt ? (
          <>
            <Divider />
            <Row
              label="انتهاء صلاحية الجلسة"
              value={
                remaining != null && remaining > 0
                  ? formatClock(remaining)
                  : "انتهت الصلاحية"
              }
              highlight={remaining != null && remaining <= 60}
            />
          </>
        ) : null}
      </View>

      <Pressable
        onPress={confirmLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
      >
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, highlight && styles.rowValueHighlight]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  rowLabel: { fontSize: 15, color: colors.onSurfaceVariant },
  rowValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
    textAlign: "left",
  },
  rowValueHighlight: { color: colors.error },
  divider: { height: 1, backgroundColor: colors.surfaceContainerHigh },
  logoutButton: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonPressed: { backgroundColor: colors.errorContainer },
  logoutText: { color: colors.error, fontSize: 17, fontWeight: "700" },
});
