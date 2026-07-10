import { useCallback, useMemo, useState } from "react";
import {
  computeCompetitionScore,
  emptyTally,
  type CompetitionScore,
  type QuestionTally,
} from "@tahkeem/shared";
import type { OpenSessionResponse, SubmitBody } from "../types";

export type TallyKey = "talathum" | "tanbih" | "fath";

type TallyMap = Record<string, QuestionTally>;
type CriterionMap = Record<string, number>;

export interface ScoringState {
  tallies: TallyMap;
  criteria: CriterionMap;
  notes: string;
  score: CompetitionScore;
  /** Questions the judge has confirmed («اعتماد تقييم السؤال»). */
  confirmed: Set<string>;
  /** Every question of the paper confirmed. Required to finalize. */
  allQuestionsConfirmed: boolean;
  /** Every general criterion has an explicit value. Required to finalize. */
  allCriteriaScored: boolean;
  setCount: (questionId: string, key: TallyKey, value: number) => void;
  setCancelled: (questionId: string, cancelled: boolean) => void;
  setCriterion: (criterionId: string, value: number) => void;
  setNotes: (notes: string) => void;
  markConfirmed: (questionId: string, confirmed: boolean) => void;
  tallyFor: (questionId: string) => QuestionTally;
  isConfirmed: (questionId: string) => boolean;
  /** One question's خاصّة tallies. `confirm` = اعتماد, else حفظ كمسودّة. */
  buildQuestionBody: (
    sessionId: string,
    questionId: string,
    confirm: boolean,
  ) => SubmitBody;
  /** The عامّة criteria, plus notes. `finalize` gates «اعتماد النتيجة». */
  buildFinalBody: (sessionId: string, finalize: boolean) => SubmitBody;
}

function initTallies(data: OpenSessionResponse): TallyMap {
  const map: TallyMap = {};
  for (const passage of data.questions) {
    map[passage.question.id] = emptyTally();
  }
  // Overlay any saved draft.
  for (const r of data.session.questionResults) {
    map[r.questionId] = {
      talathum: r.talathumCount,
      tanbih: r.tanbihCount,
      fath: r.fathCount,
      cancelled: r.cancelled,
    };
  }
  return map;
}

function initCriteria(data: OpenSessionResponse): CriterionMap {
  const map: CriterionMap = {};
  for (const s of data.session.criterionScores) {
    map[s.criterionId] = s.value;
  }
  return map;
}

/**
 * Optimistic local scoring state. The counters mutate in place for instant feel;
 * the score is recomputed on-device with the exact engine the server uses, so no
 * network round-trip is needed to show the running total.
 */
export function useScoring(data: OpenSessionResponse): ScoringState {
  const [tallies, setTallies] = useState<TallyMap>(() => initTallies(data));
  const [criteria, setCriteria] = useState<CriterionMap>(() =>
    initCriteria(data),
  );
  const [notes, setNotes] = useState<string>(data.session.notes ?? "");

  // Only a *confirmed* result row counts: a «حفظ كمسودّة» leaves its tallies but
  // confirmed=false, so resuming restores exactly which questions were locked in.
  const [confirmed, setConfirmed] = useState<Set<string>>(
    () =>
      new Set(
        data.session.questionResults
          .filter((r) => r.confirmed)
          .map((r) => r.questionId),
      ),
  );

  const tallyFor = useCallback(
    (questionId: string): QuestionTally =>
      tallies[questionId] ?? emptyTally(),
    [tallies],
  );

  const setCount = useCallback(
    (questionId: string, key: TallyKey, value: number) => {
      setTallies((prev) => {
        const current = prev[questionId] ?? emptyTally();
        return { ...prev, [questionId]: { ...current, [key]: Math.max(0, value) } };
      });
    },
    [],
  );

  const setCancelled = useCallback((questionId: string, cancelled: boolean) => {
    setTallies((prev) => {
      const current = prev[questionId] ?? emptyTally();
      return { ...prev, [questionId]: { ...current, cancelled } };
    });
  }, []);

  const setCriterion = useCallback((criterionId: string, value: number) => {
    setCriteria((prev) => ({ ...prev, [criterionId]: value }));
  }, []);

  const score = useMemo<CompetitionScore>(() => {
    const orderedTallies = data.questions.map(
      (p) => tallies[p.question.id] ?? emptyTally(),
    );
    return computeCompetitionScore({
      hifz: {
        baseScore: data.scoring.hifzBase,
        questionCount: data.scoring.questionCount,
        weights: data.scoring.weights,
        tallies: orderedTallies,
      },
      directScores: data.scoring.directCriteria.map((c) => ({
        criterionId: c.id,
        labelAr: c.labelAr,
        maxPoints: c.maxPoints,
        value: Math.min(c.maxPoints, Math.max(0, criteria[c.id] ?? 0)),
      })),
    });
  }, [data, tallies, criteria]);

  const allCriteriaScored = useMemo(
    () => data.scoring.directCriteria.every((c) => criteria[c.id] != null),
    [data.scoring.directCriteria, criteria],
  );

  const markConfirmed = useCallback((questionId: string, value: boolean) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (value) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  }, []);

  const isConfirmed = useCallback(
    (questionId: string) => confirmed.has(questionId),
    [confirmed],
  );

  const allQuestionsConfirmed = useMemo(
    () => data.questions.every((p) => confirmed.has(p.question.id)),
    [data.questions, confirmed],
  );

  // A per-question save carries ONLY that question's خاصّة tallies. The general
  // criteria never ride along here — they belong to the final step.
  const buildQuestionBody = useCallback(
    (sessionId: string, questionId: string, confirm: boolean): SubmitBody => {
      const t = tallies[questionId] ?? emptyTally();
      return {
        sessionId,
        questions: [
          {
            questionId,
            talathumCount: t.talathum,
            tanbihCount: t.tanbih,
            fathCount: t.fath,
            cancelled: t.cancelled,
            confirmed: confirm,
          },
        ],
        criterionScores: [],
        finalize: false,
      };
    },
    [tallies],
  );

  // The final step carries the عامّة criteria and notes. The server already holds
  // every question's confirmed tallies, so none are re-sent here.
  const buildFinalBody = useCallback(
    (sessionId: string, finalize: boolean): SubmitBody => ({
      sessionId,
      questions: [],
      criterionScores: data.scoring.directCriteria
        .filter((c) => criteria[c.id] != null)
        .map((c) => ({
          criterionId: c.id,
          value: Math.min(c.maxPoints, Math.max(0, criteria[c.id])),
        })),
      notes: notes.trim() ? notes.trim() : undefined,
      finalize,
    }),
    [data.scoring.directCriteria, criteria, notes],
  );

  return {
    tallies,
    criteria,
    notes,
    score,
    confirmed,
    allQuestionsConfirmed,
    allCriteriaScored,
    setCount,
    setCancelled,
    setCriterion,
    setNotes,
    markConfirmed,
    tallyFor,
    isConfirmed,
    buildQuestionBody,
    buildFinalBody,
  };
}
