import React, { forwardRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { toDisplayDigits, type PenaltyWeights, type QuestionTally } from "@tahkeem/shared";
import { colors, MIN_TOUCH, radius, spacing } from "../theme";
import { formatDeduction, formatScore } from "../lib/format";
import { Stepper } from "./Stepper";
import type { CompetitionScore } from "@tahkeem/shared";
import type { DirectCriterion, ScoringConfig } from "../types";
import type { TallyKey } from "../lib/useScoring";

interface ScoringSheetProps {
  scoring: ScoringConfig;
  questionLabel: string;
  tally: QuestionTally;
  criteriaValues: Record<string, number>;
  notes: string;
  score: CompetitionScore;
  readOnly: boolean;
  savingDraft: boolean;
  finalizing: boolean;
  canFinalize: boolean;
  onCount: (key: TallyKey, value: number) => void;
  onCancelled: (value: boolean) => void;
  onCriterion: (criterionId: string, value: number) => void;
  onNotes: (value: string) => void;
  onSaveDraft: () => void;
  onFinalize: () => void;
}

const PENALTY_ROWS: ReadonlyArray<{
  key: TallyKey;
  label: string;
  weightKey: keyof PenaltyWeights;
}> = [
  { key: "talathum", label: "تلعثم", weightKey: "talathum" },
  { key: "tanbih", label: "تنبيه", weightKey: "tanbih" },
  { key: "fath", label: "فتح", weightKey: "fath" },
];

export const ScoringSheet = forwardRef<BottomSheetModal, ScoringSheetProps>(
  function ScoringSheet(props, ref) {
    const {
      scoring,
      questionLabel,
      tally,
      criteriaValues,
      notes,
      score,
      readOnly,
      savingDraft,
      finalizing,
      canFinalize,
      onCount,
      onCancelled,
      onCriterion,
      onNotes,
      onSaveDraft,
      onFinalize,
    } = props;

    const snapPoints = useMemo(() => ["55%", "92%"], []);
    const busy = savingDraft || finalizing;

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

    const hifz = score.hifz;

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
          <Text style={styles.sheetTitle}>{questionLabel}</Text>

          {/* ── penalty counters for the current question ── */}
          <View style={styles.section}>
            {PENALTY_ROWS.map((row) => {
              const count = tally[row.key];
              const weight = scoring.weights[row.weightKey];
              const deduction = tally.cancelled ? 0 : count * weight;
              return (
                <View key={row.key} style={styles.counterRow}>
                  <View style={styles.counterLabelCol}>
                    <Text style={styles.counterLabel}>{row.label}</Text>
                    <Text style={styles.counterDeduction}>
                      ×{toDisplayDigits(count)} = {formatDeduction(deduction)}
                    </Text>
                  </View>
                  <Stepper
                    value={count}
                    onChange={(v) => onCount(row.key, v)}
                    disabled={readOnly || tally.cancelled}
                  />
                </View>
              );
            })}

            <View style={styles.cancelRow}>
              <View style={styles.counterLabelCol}>
                <Text style={styles.counterLabel}>ملغى</Text>
                <Text style={styles.counterDeduction}>
                  {tally.cancelled
                    ? `يُلغى السؤال كاملًا = ${formatDeduction(hifz.pointsPerQuestion)}`
                    : "السؤال محتسب"}
                </Text>
              </View>
              <Switch
                value={tally.cancelled}
                onValueChange={onCancelled}
                disabled={readOnly}
                trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
                thumbColor={colors.surfaceContainerLowest}
              />
            </View>
          </View>

          {/* ── direct criteria ── */}
          <Text style={styles.groupTitle}>المعايير المباشرة</Text>
          <View style={styles.section}>
            {scoring.directCriteria.map((criterion: DirectCriterion) => {
              const value = criteriaValues[criterion.id] ?? 0;
              return (
                <View key={criterion.id} style={styles.counterRow}>
                  <View style={styles.counterLabelCol}>
                    <Text style={styles.counterLabel}>{criterion.labelAr}</Text>
                    <Text style={styles.counterDeduction}>
                      {formatScore(value)} / {toDisplayDigits(criterion.maxPoints)}
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
              );
            })}
          </View>

          {/* ── notes ── */}
          <Text style={styles.groupTitle}>ملاحظات المحكّم</Text>
          <BottomSheetTextInput
            style={styles.notes}
            value={notes}
            onChangeText={onNotes}
            editable={!readOnly}
            multiline
            textAlign="right"
            placeholder="أضف ملاحظة (اختياري)…"
            placeholderTextColor={colors.outline}
          />

          {/* ── live breakdown ── */}
          <View style={styles.breakdown}>
            <BreakdownLine label="إلغاء" value={formatDeduction(hifz.cancelledPenalty)} />
            <BreakdownLine label="فتح" value={formatDeduction(hifz.fathPenalty)} />
            <BreakdownLine label="تنبيه" value={formatDeduction(hifz.tanbihPenalty)} />
            <BreakdownLine label="تلعثم" value={formatDeduction(hifz.talathumPenalty)} />
            <View style={styles.breakdownDivider} />
            <BreakdownLine
              label="عدد الحفظ"
              value={`${formatScore(hifz.score)} / ${toDisplayDigits(scoring.hifzBase)}`}
              strong
            />
            <BreakdownLine
              label="المعايير المباشرة"
              value={formatScore(score.directTotal)}
            />
            <View style={styles.breakdownDivider} />
            <BreakdownLine
              label="المجموع"
              value={`${formatScore(score.total)} / ${formatScore(score.maxTotal)}`}
              strong
              highlight
            />
          </View>

          {/* ── actions ── */}
          {readOnly ? (
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedText}>نتيجة معتمدة — للعرض فقط</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={onSaveDraft}
                disabled={busy}
                style={({ pressed }) => [
                  styles.draftButton,
                  pressed && !busy && styles.draftButtonPressed,
                  busy && styles.buttonDisabled,
                ]}
              >
                {savingDraft ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.draftButtonText}>حفظ كمسودة</Text>
                )}
              </Pressable>
              <Pressable
                onPress={onFinalize}
                disabled={busy || !canFinalize}
                style={({ pressed }) => [
                  styles.finalizeButton,
                  pressed && !busy && canFinalize && styles.finalizeButtonPressed,
                  (busy || !canFinalize) && styles.buttonDisabled,
                ]}
              >
                {finalizing ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.finalizeButtonText}>اعتماد النتيجة</Text>
                )}
              </Pressable>
            </View>
          )}
          {!readOnly && !canFinalize ? (
            <Text style={styles.hint}>
              لاعتماد النتيجة قيّم كل المعايير المباشرة أولًا.
            </Text>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

function BreakdownLine({
  label,
  value,
  strong = false,
  highlight = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.breakdownLine}>
      <Text style={[styles.breakdownLabel, strong && styles.breakdownStrong]}>
        {label}
      </Text>
      <Text
        style={[
          styles.breakdownValue,
          strong && styles.breakdownStrong,
          highlight && styles.breakdownHighlight,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surface },
  handle: { backgroundColor: colors.outline, width: 44 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "center",
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    textAlign: "right",
    marginTop: spacing.sm,
  },
  section: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH,
    gap: spacing.md,
  },
  cancelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: MIN_TOUCH,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainerHigh,
    paddingTop: spacing.sm,
  },
  counterLabelCol: { flex: 1, gap: 2 },
  counterLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onSurface,
    textAlign: "right",
  },
  counterDeduction: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: "right",
  },
  notes: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.md,
    fontSize: 15,
    color: colors.onSurface,
    textAlignVertical: "top",
    writingDirection: "rtl",
  },
  breakdown: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  breakdownLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  breakdownLabel: { fontSize: 15, color: colors.onSurfaceVariant },
  breakdownValue: { fontSize: 15, color: colors.onSurface, fontWeight: "600" },
  breakdownStrong: { fontWeight: "800", color: colors.onSurface, fontSize: 16 },
  breakdownHighlight: { color: colors.primary, fontSize: 18 },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    marginVertical: spacing.xs,
  },
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
  draftButtonPressed: { backgroundColor: colors.primaryFixed },
  draftButtonText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  finalizeButton: {
    flex: 1,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  finalizeButtonPressed: { backgroundColor: colors.primaryContainer },
  finalizeButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
  buttonDisabled: { opacity: 0.5 },
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
    marginTop: spacing.sm,
  },
  lockedText: { color: colors.onPrimaryContainer, fontSize: 16, fontWeight: "700" },
});
