import { describe, expect, it } from "vitest";
import {
  computeCompetitionScore,
  computeHifz,
  DEFAULT_HIFZ_BASE,
  DEFAULT_PENALTY_WEIGHTS,
  emptyTally,
  type QuestionTally,
} from "../scoring";

const tally = (partial: Partial<QuestionTally>): QuestionTally => ({
  ...emptyTally(),
  ...partial,
});

const hifzInput = (tallies: QuestionTally[], questionCount = tallies.length) => ({
  baseScore: DEFAULT_HIFZ_BASE,
  questionCount,
  weights: DEFAULT_PENALTY_WEIGHTS,
  tallies,
});

describe("computeHifz — the المعايير workbook formula", () => {
  it("awards the full base for a flawless recitation", () => {
    const result = computeHifz(hifzInput([emptyTally(), emptyTally()]));
    expect(result.score).toBe(60);
    expect(result.totalPenalty).toBe(0);
  });

  it("applies each penalty at its workbook weight", () => {
    // 2×تلعثم(0.25) + 1×تنبيه(0.75) = 0.5 + 0.75 = 1.25
    const result = computeHifz(
      hifzInput([tally({ talathum: 2, tanbih: 1 }), emptyTally()]),
    );
    expect(result.talathumPenalty).toBe(0.5);
    expect(result.tanbihPenalty).toBe(0.75);
    expect(result.totalPenalty).toBe(1.25);
    expect(result.score).toBe(58.75);
  });

  it("charges a cancelled question its full point value", () => {
    // 4 questions → 15 points each. One cancelled → 60 − 15 = 45.
    const result = computeHifz(
      hifzInput([
        tally({ cancelled: true }),
        emptyTally(),
        emptyTally(),
        emptyTally(),
      ]),
    );
    expect(result.pointsPerQuestion).toBe(15);
    expect(result.cancelledPenalty).toBe(15);
    expect(result.score).toBe(45);
  });

  it("does not double-charge stumbles on a cancelled question", () => {
    const result = computeHifz(
      hifzInput([tally({ cancelled: true, fath: 3, talathum: 5 }), emptyTally()]),
    );
    // Only the 30-point question value, not the 4.5+1.25 of penalties.
    expect(result.totalPenalty).toBe(30);
    expect(result.score).toBe(30);
  });

  it("combines every penalty term like the spreadsheet does", () => {
    // 3 questions → 20 pts each. 1 cancelled (20) + 2 fath (3) + 2 tanbih (1.5)
    // + 3 talathum (0.75) = 25.25 → 60 − 25.25 = 34.75
    const result = computeHifz(
      hifzInput([
        tally({ cancelled: true }),
        tally({ fath: 2, tanbih: 1 }),
        tally({ tanbih: 1, talathum: 3 }),
      ]),
    );
    expect(result.totalPenalty).toBe(25.25);
    expect(result.score).toBe(34.75);
  });

  it("floors the score at zero and flags the clamp", () => {
    const result = computeHifz(hifzInput([tally({ fath: 100 })], 1));
    expect(result.score).toBe(0);
    expect(result.clamped).toBe(true);
  });

  it("rejects a question count below one", () => {
    expect(() => computeHifz(hifzInput([], 0))).toThrow(/at least 1/);
  });
});

describe("computeCompetitionScore", () => {
  it("adds direct criteria on top of the hifz score", () => {
    const result = computeCompetitionScore({
      hifz: hifzInput([tally({ talathum: 1 }), emptyTally()]),
      directScores: [
        { criterionId: "t", labelAr: "التجويد", maxPoints: 30, value: 27 },
        { criterionId: "a", labelAr: "الأداء", maxPoints: 10, value: 8 },
      ],
    });
    expect(result.hifz.score).toBe(59.75);
    expect(result.directTotal).toBe(35);
    expect(result.total).toBe(94.75);
    expect(result.maxTotal).toBe(100);
  });

  it("rejects a direct score above its maximum", () => {
    expect(() =>
      computeCompetitionScore({
        hifz: hifzInput([emptyTally()]),
        directScores: [
          { criterionId: "t", labelAr: "التجويد", maxPoints: 30, value: 31 },
        ],
      }),
    ).toThrow(/outside 0\.\.30/);
  });
});
