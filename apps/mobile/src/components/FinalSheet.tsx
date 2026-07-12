import React, { forwardRef, useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { toDisplayDigits, type CompetitionScore } from "@tahkeem/shared";
import { colors, MIN_TOUCH, radius, spacing } from "../theme";
import { formatScore } from "../lib/format";
import { Stepper } from "./Stepper";
import type { DirectCriterion, ScoringConfig } from "../types";

/**
 * The final step: the «عامّة» criteria (تجويد, صوت) rated once, then the whole
 * result committed. It opens only after every question's «خاصّة» is confirmed.
 */
interface FinalSheetProps {
  scoring: ScoringConfig;
  criteriaValues: Record<string, number>;
  score: CompetitionScore;
  readOnly: boolean;
  /** Every question confirmed — otherwise finalising is blocked. */
  allQuestionsConfirmed: boolean;
  confirmedCount: number;
  totalQuestions: number;
  savingDraft: boolean;
  finalizing: boolean;
  onCriterion: (criterionId: string, value: number) => void;
  onSaveDraft: () => void;
  onFinalize: () => void;
}

export const FinalSheet = forwardRef<BottomSheetModal, FinalSheetProps>(
  function FinalSheet(props, ref) {
    const {
      scoring,
      criteriaValues,
      score,
      readOnly,
      allQuestionsConfirmed,
      confirmedCount,
      totalQuestions,
      savingDraft,
      finalizing,
      onCriterion,
      onSaveDraft,
      onFinalize,
    } = props;

    const snapPoints = useMemo(() => ["55%", "88%"], []);
    const busy = savingDraft || finalizing;
    const allCriteriaScored = scoring.directCriteria.every(
      (c) => criteriaValues[c.id] != null,
    );
    const canFinalize = allQuestionsConfirmed && allCriteriaScored;

    const renderBackdrop = useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...backdropProps}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="collapse"
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBg}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>المعايير العامّة</Text>
          <Text style={styles.caption}>التجويد والصوت — تُقيَّم بعد آخر سؤال</Text>

          <View style={styles.section}>
            {scoring.directCriteria.map((criterion: DirectCriterion) => {
              const value = criteriaValues[criterion.id] ?? 0;
              const unset = criteriaValues[criterion.id] == null;
              // The band the current value falls in — the guidance to surface.
              const activeBand = criterion.bands.find(
                (b) => value >= b.minPoints && value <= b.maxPoints,
              );
              return (
                <View key={criterion.id} style={styles.criterion}>
                  <View style={styles.row}>
                    <View style={styles.labelCol}>
                      <Text style={styles.label}>{criterion.labelAr}</Text>
                      <Text style={styles.sub}>
                        {unset ? "لم تُقيَّم بعد" : formatScore(value)} /{" "}
                        {toDisplayDigits(criterion.maxPoints)}
                        {criterion.scaleLabelAr
                          ? `  ·  ${criterion.scaleLabelAr}`
                          : ""}
                      </Text>
                    </View>
                    <Stepper
                      value={value}
                      onChange={(v) => onCriterion(criterion.id, v)}
                      min={0}
                      max={criterion.maxPoints}
                      disabled={readOnly}
                    />
                  </View>
                  {activeBand ? (
                    <Text style={styles.bandText}>{activeBand.descriptionAr}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>المجموع النهائي</Text>
            <Text style={styles.totalValue}>
              {formatScore(score.total)} / {formatScore(score.maxTotal)}
            </Text>
          </View>

          {readOnly ? (
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedText}>نتيجة معتمدة — للعرض فقط</Text>
            </View>
          ) : (
            <>
              <View style={styles.actions}>
                <Pressable
                  onPress={onSaveDraft}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.draftButton,
                    pressed && !busy && styles.draftPressed,
                    busy && styles.disabled,
                  ]}
                >
                  {savingDraft ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.draftText}>حفظ كمسودّة</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={onFinalize}
                  disabled={busy || !canFinalize}
                  style={({ pressed }) => [
                    styles.finalizeButton,
                    pressed && canFinalize && !busy && styles.finalizePressed,
                    (busy || !canFinalize) && styles.disabled,
                  ]}
                >
                  {finalizing ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.finalizeText}>اعتماد النتيجة النهائية</Text>
                  )}
                </Pressable>
              </View>
              {!canFinalize ? (
                <Text style={styles.hint}>
                  {!allQuestionsConfirmed
                    ? `أكّد تقييم كل الأسئلة أولًا (${toDisplayDigits(confirmedCount)}/${toDisplayDigits(totalQuestions)})`
                    : "قيّم كل المعايير العامّة أولًا"}
                </Text>
              ) : null}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surface },
  handle: { backgroundColor: colors.outline, width: 44 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface, textAlign: "right" },
  caption: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: "right",
    marginTop: -spacing.xs,
  },
  section: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  criterion: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH,
    gap: spacing.md,
  },
  bandText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: "right",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  labelCol: { flex: 1, gap: 2 },
  label: { fontSize: 17, fontWeight: "700", color: colors.onSurface, textAlign: "right" },
  sub: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: "right" },
  totalCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: { fontSize: 15, color: colors.onSurfaceVariant },
  totalValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  draftButton: {
    flex: 1,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  draftPressed: { backgroundColor: colors.primaryFixed },
  draftText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  finalizeButton: {
    flex: 1.4,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  finalizePressed: { backgroundColor: colors.primary },
  finalizeText: { color: colors.onPrimary, fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  hint: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  lockedBanner: {
    backgroundColor: colors.primaryFixed,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  lockedText: { color: colors.onPrimaryContainer, fontSize: 16, fontWeight: "700" },
});
