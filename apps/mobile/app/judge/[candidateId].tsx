import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { toArabicDigits } from "@tahkeem/shared";
import { MushafPanel } from "../../src/components/MushafPanel";
import { ScoringSheet } from "../../src/components/ScoringSheet";
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
  const [current, setCurrent] = useState(0);
  const [action, setAction] = useState<"draft" | "finalize" | null>(null);

  const readOnly = data.session.status === "SUBMITTED";
  const questions = data.questions;
  const total = questions.length;
  const passage = questions[current];

  const questionLabel = useMemo(
    () => `السؤال ${toArabicDigits(current + 1)} من ${toArabicDigits(total)}`,
    [current, total],
  );

  const openSheet = useCallback(() => sheetRef.current?.present(), []);

  const runSubmit = useCallback(
    async (finalize: boolean) => {
      if (!passage) return;
      setAction(finalize ? "finalize" : "draft");
      try {
        const body = scoring.buildBody(data.session.id, finalize);
        await submit.mutateAsync(body);
        sheetRef.current?.dismiss();
        Alert.alert(
          finalize ? "تم الاعتماد" : "تم الحفظ",
          finalize
            ? "تم اعتماد النتيجة بنجاح."
            : "تم حفظ المسودة بنجاح.",
        );
      } catch (e) {
        Alert.alert("تعذّر الحفظ", apiErrorMessage(e));
      } finally {
        setAction(null);
      }
    },
    [passage, scoring, data.session.id, submit],
  );

  const onFinalize = useCallback(() => {
    Alert.alert(
      "اعتماد النتيجة",
      "بعد الاعتماد لا يمكن تعديل النتيجة. هل تريد المتابعة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "اعتماد",
          style: "destructive",
          onPress: () => void runSubmit(true),
        },
      ],
    );
  }, [runSubmit]);

  const currentTally = passage
    ? scoring.tallyFor(passage.question.id)
    : undefined;

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

      {/* question selector */}
      <View style={styles.selector}>
        <Pressable
          onPress={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          style={[styles.navButton, current === 0 && styles.navDisabled]}
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
        >
          <Text style={styles.navGlyph}>‹</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dots}
      >
        {questions.map((q, i) => (
          <Pressable
            key={q.question.id}
            onPress={() => setCurrent(i)}
            style={[styles.dot, i === current && styles.dotActive]}
          >
            <Text style={[styles.dotText, i === current && styles.dotTextActive]}>
              {toArabicDigits(i + 1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* mushaf */}
      <View style={styles.mushafWrap}>
        {passage ? <MushafPanel passage={passage} /> : null}
      </View>

      {/* bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.totalCol}>
          <Text style={styles.totalLabel}>المجموع</Text>
          <Text style={styles.totalValue}>
            {formatScore(scoring.score.total)} / {formatScore(scoring.score.maxTotal)}
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
            {readOnly ? "عرض التقييم" : "فتح لوحة التقييم"}
          </Text>
        </Pressable>
      </View>

      {passage && currentTally ? (
        <ScoringSheet
          ref={sheetRef}
          scoring={data.scoring}
          questionLabel={questionLabel}
          tally={currentTally}
          criteriaValues={scoring.criteria}
          notes={scoring.notes}
          score={scoring.score}
          readOnly={readOnly}
          savingDraft={action === "draft"}
          finalizing={action === "finalize"}
          canFinalize={scoring.allCriteriaScored}
          onCount={(key: TallyKey, value: number) =>
            scoring.setCount(passage.question.id, key, value)
          }
          onCancelled={(value: boolean) =>
            scoring.setCancelled(passage.question.id, value)
          }
          onCriterion={scoring.setCriterion}
          onNotes={scoring.setNotes}
          onSaveDraft={() => void runSubmit(false)}
          onFinalize={onFinalize}
        />
      ) : null}
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
    paddingTop: spacing.md,
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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row-reverse",
  },
  dot: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  dotActive: { backgroundColor: colors.primary },
  dotText: { fontSize: 15, fontWeight: "700", color: colors.onSurfaceVariant },
  dotTextActive: { color: colors.onPrimary },
  mushafWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
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
