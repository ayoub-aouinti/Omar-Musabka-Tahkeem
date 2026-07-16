import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { computeHifz, emptyTally, toDisplayDigits } from "@tahkeem/shared";
import { MushafPanel } from "../../src/components/MushafPanel";
import { ScoringSheet } from "../../src/components/ScoringSheet";
import { FinalSheet } from "../../src/components/FinalSheet";
import { apiErrorMessage } from "../../src/lib/api";
import { useOpenSession, useSubmitSession } from "../../src/lib/judging";
import { useScoring, type TallyKey } from "../../src/lib/useScoring";
import { useElapsed } from "../../src/lib/useElapsed";
import { formatClock, formatScore } from "../../src/lib/format";
import { colors, MIN_TOUCH, radius, spacing } from "../../src/theme";
import type { OpenSessionResponse } from "../../src/types";

export default function JudgeScreen() {
  const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
  const id = candidateId ?? "";
  const { data, isLoading, isError, error, refetch } = useOpenSession(id);

  return (
    <View style={styles.flex}>
      {isLoading ? (
        <Centered>
          <ActivityIndicator size="large" color={colors.primary} />
        </Centered>
      ) : isError || !data ? (
        <Centered>
          <Text style={styles.error}>{apiErrorMessage(error)}</Text>
          <Pressable style={styles.retry} onPress={() => void refetch()}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </Centered>
      ) : (
        <JudgeSession candidateId={id} data={data} />
      )}
    </View>
  );
}

function JudgeSession({
  candidateId,
  data,
}: {
  candidateId: string;
  data: OpenSessionResponse;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const elapsed = useElapsed();
  const scoring = useScoring(data);
  const submit = useSubmitSession(candidateId);

  const sheetRef = useRef<BottomSheetModal>(null);
  const finalSheetRef = useRef<BottomSheetModal>(null);
  const [current, setCurrent] = useState(0);
  const [action, setAction] = useState<
    "confirm" | "draft" | "finalDraft" | "finalize" | null
  >(null);

  useEffect(() => {
    if (!scoring.autoCancelAlert) return;
    Alert.alert("السؤال ألغي تلقائيًا", scoring.autoCancelAlert, [
      { text: "حسنًا", onPress: scoring.dismissAutoCancelAlert },
    ]);
  }, [scoring.autoCancelAlert, scoring.dismissAutoCancelAlert]);

  const readOnly = data.session.status === "SUBMITTED";
  const questions = data.questions;
  const total = questions.length;
  const passage = questions[current];
  const hasNext = current < total - 1;

  const questionLabel = useMemo(
    () => `السؤال ${toDisplayDigits(current + 1)} من ${toDisplayDigits(total)}`,
    [current, total],
  );

  const openSheet = useCallback(() => sheetRef.current?.present(), []);

  /** Save the open question's خاصّة tallies; `confirm` locks it in. */
  const saveQuestion = useCallback(
    async (confirm: boolean) => {
      if (!passage) return;
      const questionId = passage.question.id;
      setAction(confirm ? "confirm" : "draft");
      try {
        await submit.mutateAsync(
          scoring.buildQuestionBody(data.session.id, questionId, confirm),
        );
        scoring.markConfirmed(questionId, confirm);
        sheetRef.current?.dismiss();
        if (confirm && hasNext) setCurrent((c) => c + 1);
      } catch (e) {
        Alert.alert("تعذّر الحفظ", apiErrorMessage(e));
      } finally {
        setAction(null);
      }
    },
    [passage, scoring, data.session.id, submit, hasNext],
  );

  /** Save the عامّة criteria (finalize=false), or commit the whole result. */
  const runFinal = useCallback(
    async (finalize: boolean) => {
      setAction(finalize ? "finalize" : "finalDraft");
      try {
        await submit.mutateAsync(
          scoring.buildFinalBody(data.session.id, finalize),
        );
        if (finalize) {
          finalSheetRef.current?.dismiss();
          Alert.alert("تم الاعتماد", "تم اعتماد نتيجة المتسابق بنجاح.");
        }
      } catch (e) {
        Alert.alert(
          finalize ? "تعذّر الاعتماد" : "تعذّر الحفظ",
          apiErrorMessage(e),
        );
      } finally {
        setAction(null);
      }
    },
    [scoring, data.session.id, submit],
  );

  const onFinalize = useCallback(() => {
    Alert.alert(
      "اعتماد النتيجة النهائية",
      "بعد الاعتماد لا يمكن تعديل النتيجة. هل تريد المتابعة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "اعتماد",
          style: "destructive",
          onPress: () => void runFinal(true),
        },
      ],
    );
  }, [runFinal]);

  const currentTally = passage
    ? scoring.tallyFor(passage.question.id)
    : undefined;

  // This question's own contribution to عدد الحفظ, for the sheet's breakdown.
  const questionHifz = useMemo(
    () =>
      computeHifz({
        baseScore: data.scoring.pointsPerQuestion,
        questionCount: 1,
        weights: data.scoring.weights,
        tallies: [currentTally ?? emptyTally()],
      }),
    [data.scoring, currentTally],
  );

  return (
    <View style={styles.flex}>
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="رجوع"
        >
          <Text style={styles.backGlyph}>›</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.candidateName} numberOfLines={1}>
            {data.candidate.fullName}
          </Text>
          <Text style={styles.categoryLabel}>{data.candidate.category.labelAr}</Text>
        </View>
        <View style={styles.timer}>
          <Text style={styles.timerText}>{formatClock(elapsed)}</Text>
        </View>
      </View>

      {readOnly ? (
        <View style={styles.submittedBanner}>
          <Text style={styles.submittedText}>
            نتيجة معتمدة — المجموع {formatScore(scoring.score.total)} /{" "}
            {formatScore(scoring.score.maxTotal)}
          </Text>
        </View>
      ) : null}

      {/* question selector — compact, so the mushaf gets the height */}
      <View style={styles.selector}>
        <Pressable
          onPress={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          style={[styles.navButton, current === 0 && styles.navDisabled]}
          accessibilityLabel="السؤال السابق"
        >
          <Text style={styles.navGlyph}>›</Text>
        </Pressable>

        <View style={styles.selectorCenter}>
          <Text style={styles.selectorLabel}>{questionLabel}</Text>
          {passage ? (
            <Text style={styles.passageLabel} numberOfLines={1}>
              {passage.label}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => setCurrent((c) => Math.min(total - 1, c + 1))}
          disabled={current >= total - 1}
          style={[styles.navButton, current >= total - 1 && styles.navDisabled]}
          accessibilityLabel="السؤال التالي"
        >
          <Text style={styles.navGlyph}>‹</Text>
        </Pressable>
      </View>

      <View style={styles.dots}>
        {questions.map((q, i) => {
          const confirmed = scoring.isConfirmed(q.question.id);
          return (
            <Pressable
              key={q.question.id}
              onPress={() => setCurrent(i)}
              style={[
                styles.dot,
                confirmed && styles.dotConfirmed,
                i === current && styles.dotActive,
              ]}
              accessibilityLabel={`السؤال ${i + 1}${confirmed ? " — مؤكَّد" : ""}`}
            >
              <Text
                style={[styles.dotText, i === current && styles.dotTextActive]}
              >
                {confirmed && i !== current ? "✓" : toDisplayDigits(i + 1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* mushaf — full page, question highlighted */}
      <View style={styles.mushafWrap}>
        {passage ? <MushafPanel page={passage.page} /> : null}
      </View>

      {/* bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.barRow}>
          <View style={styles.totalCol}>
            <Text style={styles.totalLabel}>المجموع</Text>
            <Text style={styles.totalValue}>
              {formatScore(scoring.score.total)} /{" "}
              {formatScore(scoring.score.maxTotal)}
            </Text>
          </View>
          <Pressable
            onPress={openSheet}
            style={({ pressed }) => [
              styles.openButton,
              pressed && styles.openButtonPressed,
            ]}
          >
            <Text style={styles.openButtonText}>
              {readOnly ? "عرض تقييم السؤال" : "تقييم هذا السؤال"}
            </Text>
          </Pressable>
        </View>

        {/* The عامّة criteria + final approval open in their own sheet. */}
        <Pressable
          onPress={() => finalSheetRef.current?.present()}
          style={({ pressed }) => [
            styles.finalizeButton,
            pressed && styles.finalizeButtonPressed,
          ]}
        >
          <Text style={styles.finalizeButtonText}>
            {readOnly
              ? "عرض النتيجة النهائية"
              : `المعايير العامّة والاعتماد (${toDisplayDigits(scoring.confirmed.size)}/${toDisplayDigits(total)})`}
          </Text>
        </Pressable>
      </View>

      {passage && currentTally ? (
        <ScoringSheet
          ref={sheetRef}
          scoring={data.scoring}
          questionLabel={questionLabel}
          tally={currentTally}
          hifz={questionHifz}
          notes={scoring.notes}
          readOnly={readOnly}
          confirming={action === "confirm"}
          savingDraft={action === "draft"}
          isConfirmed={scoring.isConfirmed(passage.question.id)}
          hasNext={hasNext}
          onCount={(key: TallyKey, value: number) =>
            scoring.setCount(passage.question.id, key, value)
          }
          onCancelled={(value: boolean) =>
            scoring.setCancelled(passage.question.id, value)
          }
          onNotes={scoring.setNotes}
          onConfirm={() => void saveQuestion(true)}
          onSaveDraft={() => void saveQuestion(false)}
        />
      ) : null}

      <FinalSheet
        ref={finalSheetRef}
        scoring={data.scoring}
        criteriaValues={scoring.criteria}
        score={scoring.score}
        readOnly={readOnly}
        allQuestionsConfirmed={scoring.allQuestionsConfirmed}
        confirmedCount={scoring.confirmed.size}
        totalQuestions={total}
        savingDraft={action === "finalDraft"}
        finalizing={action === "finalize"}
        onCriterion={scoring.setCriterion}
        onSaveDraft={() => void runFinal(false)}
        onFinalize={onFinalize}
      />
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.centered, { paddingTop: insets.top + spacing.xxl }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  error: { color: colors.error, fontSize: 16, textAlign: "center" },
  retry: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
  },
  backGlyph: { fontSize: 34, color: colors.primary, fontWeight: "700" },
  headerCenter: { flex: 1, alignItems: "center" },
  candidateName: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  categoryLabel: { fontSize: 13, color: colors.onSurfaceVariant },
  timer: {
    minWidth: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
  },
  timerText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
    fontVariant: ["tabular-nums"],
  },
  submittedBanner: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  submittedText: { color: colors.onPrimary, fontSize: 15, fontWeight: "700" },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  navButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  navDisabled: { opacity: 0.4 },
  navGlyph: { fontSize: 30, color: colors.onSurfaceVariant, fontWeight: "700" },
  selectorCenter: { flex: 1, alignItems: "center" },
  selectorLabel: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  passageLabel: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 2 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dot: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  dotConfirmed: { backgroundColor: colors.primaryFixed },
  dotActive: { backgroundColor: colors.primary },
  dotText: { fontSize: 15, fontWeight: "700", color: colors.onSurfaceVariant },
  dotTextActive: { color: colors.onPrimary },
  mushafWrap: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  bottomBar: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
  },
  finalizeButton: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  finalizeButtonPressed: { backgroundColor: colors.primary },
  finalizeButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "800" },
  totalCol: { gap: 2 },
  totalLabel: { fontSize: 13, color: colors.onSurfaceVariant },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
  openButton: {
    flex: 1,
    maxWidth: 220,
    minHeight: MIN_TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  openButtonPressed: { backgroundColor: colors.primaryContainer },
  openButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
});
