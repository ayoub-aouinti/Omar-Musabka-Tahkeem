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
import type { ScoringConfig } from "../types";
import type { TallyKey } from "../lib/useScoring";

/**
 * The «خاصّة» sheet — the memorisation (hifز) tallies for ONE question. The
 * «عامّة» criteria (تجويد, صوت) are not here; they belong to the final step.
 */
interface ScoringSheetProps {
  scoring: ScoringConfig;
  questionLabel: string;
  tally: QuestionTally;
  /** This question's own hifz deduction, for the live breakdown. */
  hifz: {
    pointsPerQuestion: number;
    talathumPenalty: number;
    tanbihPenalty: number;
    fathPenalty: number;
    cancelledPenalty: number;
    score: number;
  };
  readOnly: boolean;
  /** اعتماد تقييم السؤال in flight. */
  confirming: boolean;
  /** حفظ كمسودّة in flight. */
  savingDraft: boolean;
  /** This question is already confirmed. */
  isConfirmed: boolean;
  hasNext: boolean;
  onCount: (key: TallyKey, value: number) => void;
  onCancelled: (value: boolean) => void;
  onNotes: (value: string) => void;
  notes: string;
  onConfirm: () => void;
  onSaveDraft: () => void;
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
      hifz,
      notes,
      readOnly,
      confirming,
      savingDraft,
      isConfirmed,
      hasNext,
      onCount,
      onCancelled,
      onNotes,
      onConfirm,
      onSaveDraft,
    } = props;

    const snapPoints = useMemo(() => ["55%", "92%"], []);

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
          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle}>{questionLabel}</Text>
            <View
              style={[styles.badge, isConfirmed ? styles.badgeOn : styles.badgeOff]}
            >
              <Text
                style={
                  isConfirmed ? styles.badgeOnText : styles.badgeOffText
                }
              >
                {isConfirmed ? "مؤكَّد" : "مسودّة"}
              </Text>
            </View>
          </View>
          <Text style={styles.groupCaption}>المعايير الخاصّة (الحفظ)</Text>

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

          {/* ── live breakdown for THIS question ── */}
          <View style={styles.breakdown}>
            <BreakdownLine label="إلغاء" value={formatDeduction(hifz.cancelledPenalty)} />
            <BreakdownLine label="فتح" value={formatDeduction(hifz.fathPenalty)} />
            <BreakdownLine label="تنبيه" value={formatDeduction(hifz.tanbihPenalty)} />
            <BreakdownLine label="تلعثم" value={formatDeduction(hifz.talathumPenalty)} />
            <View style={styles.breakdownDivider} />
            <BreakdownLine
              label="نقاط هذا السؤال"
              value={`${formatScore(hifz.score)} / ${formatScore(hifz.pointsPerQuestion)}`}
              strong
              highlight
            />
          </View>

          {/* ── actions: this question only ── */}
          {readOnly ? (
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedText}>نتيجة معتمدة — للعرض فقط</Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={onSaveDraft}
                disabled={confirming || savingDraft}
                style={({ pressed }) => [
                  styles.draftButton,
                  pressed && !savingDraft && styles.draftButtonPressed,
                  (confirming || savingDraft) && styles.buttonDisabled,
                ]}
              >
                {savingDraft ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.draftButtonText}>حفظ كمسودّة</Text>
                )}
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={confirming || savingDraft}
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && !confirming && styles.confirmButtonPressed,
                  (confirming || savingDraft) && styles.buttonDisabled,
                ]}
              >
                {confirming ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {hasNext ? "اعتماد والتالي ›" : "اعتماد التقييم"}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
          {!readOnly ? (
            <Text style={styles.hint}>
              معايير التجويد والصوت العامّة تُقيَّم بعد آخر سؤال مع اعتماد النتيجة
              النهائية.
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "right",
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeOn: { backgroundColor: colors.primaryFixed },
  badgeOff: { backgroundColor: colors.surfaceContainerHigh },
  badgeOnText: { color: colors.onPrimaryContainer, fontSize: 12, fontWeight: "700" },
  badgeOffText: { color: colors.onSurfaceVariant, fontSize: 12, fontWeight: "700" },
  groupCaption: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: "right",
    marginTop: -spacing.xs,
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
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
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
  confirmButton: {
    flex: 1,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonPressed: { backgroundColor: colors.primaryContainer },
  confirmButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
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
