import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CandidateCard } from "../../src/components/CandidateCard";
import { apiErrorMessage } from "../../src/lib/api";
import { useCandidates } from "../../src/lib/judging";
import { colors, spacing } from "../../src/theme";
import type { CandidateListItem, JudgingStatus } from "../../src/types";

const ACTIVE: ReadonlySet<JudgingStatus> = new Set([
  "IN_PROGRESS",
  "DRAFT_SAVED",
]);

export default function ActiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useCandidates();

  const active = useMemo(
    () =>
      (data ?? []).filter((c) => {
        const status = c.judgingSessions[0]?.status;
        return status ? ACTIVE.has(status) : false;
      }),
    [data],
  );

  const renderItem = ({ item }: { item: CandidateListItem }) => (
    <CandidateCard
      candidate={item}
      onPress={() => router.push(`/judge/${item.id}`)}
    />
  );

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>التحكيم الجاري</Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>{apiErrorMessage(error)}</Text>
        </View>
      ) : (
        <FlatList
          data={active}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                لا توجد جلسات قيد التحكيم. ابدأ من قائمة المتسابقين.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  error: { color: colors.error, fontSize: 16, textAlign: "center" },
  empty: {
    color: colors.onSurfaceVariant,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 26,
  },
});
