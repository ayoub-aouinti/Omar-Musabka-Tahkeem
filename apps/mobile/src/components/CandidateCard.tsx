import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { toArabicDigits } from "@tahkeem/shared";
import { colors, radius, spacing } from "../theme";
import { formatDate, formatScore } from "../lib/format";
import { statusInfo } from "../lib/status";
import { Chip } from "./Chip";
import type { CandidateListItem } from "../types";

const GENDER_LABEL: Record<CandidateListItem["gender"], string> = {
  MALE: "ذكر",
  FEMALE: "أنثى",
};

export function CandidateCard({
  candidate,
  onPress,
}: {
  candidate: CandidateListItem;
  onPress: () => void;
}) {
  const session = candidate.judgingSessions[0];
  const status = statusInfo(session);
  const isDone = status.status === "SUBMITTED";
  const score =
    isDone && session?.totalScore != null
      ? ` · ${formatScore(session.totalScore)}`
      : "";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { borderRightColor: status.color },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>
          {candidate.fullName}
        </Text>
        <Chip
          label={`${status.label}${score}`}
          color={status.container}
          textColor={status.onContainer}
        />
      </View>

      <View style={styles.metaRow}>
        <Chip label={candidate.category.labelAr} />
        {candidate.externalId != null ? (
          <Text style={styles.meta}>
            المعرّف: #{toArabicDigits(candidate.externalId)}
          </Text>
        ) : null}
      </View>

      {candidate.teacherName ? (
        <Text style={styles.meta}>المحفّظ(ة): {candidate.teacherName}</Text>
      ) : null}

      <View style={styles.inlineRow}>
        <Text style={styles.meta}>{GENDER_LABEL[candidate.gender]}</Text>
        {candidate.birthDate ? (
          <Text style={styles.meta}>· {formatDate(candidate.birthDate)}</Text>
        ) : null}
      </View>

      <View style={styles.scopeRow}>
        <Text style={styles.scope} numberOfLines={2}>
          {candidate.scopeRaw}
        </Text>
        {candidate.scopeReversed ? (
          <Chip
            label="مكتوب بالمقلوب"
            color={colors.errorContainer}
            textColor={colors.error}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRightWidth: 5,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardPressed: { backgroundColor: colors.surfaceContainerLow },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "right",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: "right",
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  scope: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurface,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
