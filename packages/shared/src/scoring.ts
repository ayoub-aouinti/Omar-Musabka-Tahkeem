/**
 * The scoring engine, transcribed from the `المعايير` sheet of the branch's
 * competition workbook:
 *
 *   عدد الحفظ = 60 − ( ملغى × عدد السؤال + فتح × 1.5 + تنبيه × 0.75 + تلعثم × 0.25 )
 *
 * A cancelled question (`ملغى`) forfeits that question's full point value, so
 * the per-question value is the hifz base divided by the question count. The
 * weights and the base are stored per competition rather than hard-coded.
 */

/** Deduction per occurrence, in points. Defaults mirror the 2026 workbook. */
export interface PenaltyWeights {
  /** تلعثم — the reciter stumbles but recovers unaided. */
  talathum: number;
  /** تنبيه — the judge prompts with a hint. */
  tanbih: number;
  /** فتح — the judge supplies the word outright. */
  fath: number;
}

export const DEFAULT_PENALTY_WEIGHTS: PenaltyWeights = {
  talathum: 0.25,
  tanbih: 0.75,
  fath: 1.5,
};

export const DEFAULT_HIFZ_BASE = 60;

/** What the judge tapped for one drawn question. */
export interface QuestionTally {
  talathum: number;
  tanbih: number;
  fath: number;
  /** ملغى — the question is written off entirely. */
  cancelled: boolean;
}

export interface HifzInput {
  /** Total points the hifz criterion is worth (60 in the workbook). */
  baseScore: number;
  /** How many questions the candidate is asked. Must be >= 1. */
  questionCount: number;
  weights: PenaltyWeights;
  tallies: QuestionTally[];
}

export interface HifzBreakdown {
  pointsPerQuestion: number;
  cancelledPenalty: number;
  fathPenalty: number;
  tanbihPenalty: number;
  talathumPenalty: number;
  /** Sum of the four penalties before clamping. */
  totalPenalty: number;
  /** `baseScore − totalPenalty`, clamped to [0, baseScore]. */
  score: number;
  /** True when penalties exceeded the base and the score was floored at 0. */
  clamped: boolean;
}

/** Round to 2 decimals; penalties are quarter-points so this is exact enough. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function emptyTally(): QuestionTally {
  return { talathum: 0, tanbih: 0, fath: 0, cancelled: false };
}

export function computeHifz(input: HifzInput): HifzBreakdown {
  const { baseScore, questionCount, weights, tallies } = input;

  if (questionCount < 1) {
    throw new Error("questionCount must be at least 1");
  }
  if (baseScore < 0) {
    throw new Error("baseScore must not be negative");
  }

  const pointsPerQuestion = baseScore / questionCount;

  let cancelledPenalty = 0;
  let fathPenalty = 0;
  let tanbihPenalty = 0;
  let talathumPenalty = 0;

  for (const tally of tallies) {
    // A cancelled question is written off whole; its stumbles are not also
    // charged, otherwise the candidate would be penalised twice for it.
    if (tally.cancelled) {
      cancelledPenalty += pointsPerQuestion;
      continue;
    }
    fathPenalty += tally.fath * weights.fath;
    tanbihPenalty += tally.tanbih * weights.tanbih;
    talathumPenalty += tally.talathum * weights.talathum;
  }

  const totalPenalty =
    cancelledPenalty + fathPenalty + tanbihPenalty + talathumPenalty;
  const raw = baseScore - totalPenalty;

  return {
    pointsPerQuestion: round2(pointsPerQuestion),
    cancelledPenalty: round2(cancelledPenalty),
    fathPenalty: round2(fathPenalty),
    tanbihPenalty: round2(tanbihPenalty),
    talathumPenalty: round2(talathumPenalty),
    totalPenalty: round2(totalPenalty),
    score: round2(Math.min(baseScore, Math.max(0, raw))),
    clamped: raw < 0,
  };
}

/** A criterion the judge rates directly (تجويد, أداء) rather than by penalty. */
export interface DirectCriterionScore {
  criterionId: string;
  labelAr: string;
  maxPoints: number;
  value: number;
}

export interface CompetitionScoreInput {
  hifz: HifzInput;
  directScores: DirectCriterionScore[];
}

export interface CompetitionScore {
  hifz: HifzBreakdown;
  directTotal: number;
  /** hifz + every direct criterion. */
  total: number;
  /** hifz base + every criterion's max, i.e. what a flawless recitation scores. */
  maxTotal: number;
}

export function computeCompetitionScore(
  input: CompetitionScoreInput,
): CompetitionScore {
  const hifz = computeHifz(input.hifz);

  for (const criterion of input.directScores) {
    if (criterion.value < 0 || criterion.value > criterion.maxPoints) {
      throw new Error(
        `Score ${criterion.value} for "${criterion.labelAr}" is outside 0..${criterion.maxPoints}`,
      );
    }
  }

  const directTotal = input.directScores.reduce((sum, c) => sum + c.value, 0);
  const maxDirect = input.directScores.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    hifz,
    directTotal: round2(directTotal),
    total: round2(hifz.score + directTotal),
    maxTotal: round2(input.hifz.baseScore + maxDirect),
  };
}
