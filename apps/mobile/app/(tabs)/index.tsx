import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { toArabicDigits } from "@tahkeem/shared";
import { CandidateCard } from "../../src/components/CandidateCard";
import { Chip } from "../../src/components/Chip";
import { apiErrorMessage } from "../../src/lib/api";
import { useCandidates } from "../../src/lib/judging";
import { colors, MIN_TOUCH, radius, spacing } from "../../src/theme";
import type { CandidateListItem } from "../../src/types";

export default function CandidatesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useCandidates();

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((c) => map.set(c.category.id, c.category.labelAr));
    return [...map.entries()].map(([id, labelAr]) => ({ id, labelAr }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return (data ?? []).filter((c) => {
      if (categoryId && c.category.id !== categoryId) return false;
      if (!q) return true;
      const idText = c.externalId != null ? String(c.externalId) : "";
      return (
        c.fullName.includes(q) ||
        idText.includes(q) ||
        (c.teacherName?.includes(q) ?? false)
      );
    });
  }, [data, search, categoryId]);

  const renderItem = ({ item }: { item: CandidateListItem }) => (
    <CandidateCard
      candidate={item}
      onPress={() => router.push(`/judge/${item.id}`)}
    />
  );

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>المتسابقون</Text>
        {data ? (
          <Text style={styles.count}>{toArabicDigits(filtered.length)}</Text>
        ) : null}
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="بحث بالاسم أو المعرّف…"
        placeholderTextColor={colors.outline}
        textAlign="right"
      />

      {categories.length > 0 ? (
        <FlatList
          horizontal
          inverted
          showsHorizontalScrollIndicator={false}
          data={[{ id: "__all__", labelAr: "الكل" }, ...categories]}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => {
            const isAll = item.id === "__all__";
            const selected = isAll ? categoryId === null : categoryId === item.id;
            return (
              <Chip
                label={item.labelAr}
                selected={selected}
                onPress={() => setCategoryId(isAll ? null : item.id)}
              />
            );
          }}
        />
      ) : null}

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
          data={filtered}
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
              <Text style={styles.empty}>لا يوجد متسابقون مطابقون</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  count: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onPrimaryContainer,
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  search: {
    marginHorizontal: spacing.lg,
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.onSurface,
    writingDirection: "rtl",
  },
  chipsRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  error: { color: colors.error, fontSize: 16, textAlign: "center" },
  empty: { color: colors.onSurfaceVariant, fontSize: 16 },
});
