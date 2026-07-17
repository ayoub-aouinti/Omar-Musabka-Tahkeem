import { describe, expect, it } from "vitest";
import {
  autoCancelMessage,
  computeCompetitionScore,
  computeHifz,
  DEFAULT_HIFZ_BASE,
  DEFAULT_PENALTY_WEIGHTS,
  emptyTally,
  isAutoCancelTriggered,
  isAutoCancelTriggeredByTap,
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

describe("isAutoCancelTriggered — order-independent, from final counts only", () => {
  it("is disabled when no threshold is configured", () => {
    expect(isAutoCancelTriggered(tally({ fath: 4 }), null)).toBe(false);
    expect(isAutoCancelTriggered(tally({ fath: 4 }), undefined)).toBe(false);
  });

  it("does not trigger below or at the threshold", () => {
    expect(isAutoCancelTriggered(tally({ fath: 2 }), 3)).toBe(false);
    expect(isAutoCancelTriggered(tally({ fath: 3 }), 3)).toBe(false);
  });

  it("triggers on a فتح count past the threshold — unambiguous regardless of order", () => {
    expect(isAutoCancelTriggered(tally({ fath: 4 }), 3)).toBe(true);
  });

  it("does NOT trigger on a تنبيه/تلعثم next to a threshold فتح count — order is unknown", () => {
    // Could have been recorded before فتح ever reached the threshold; see the
    // isAutoCancelTriggeredByTap suite for the order-aware version that
    // judges the live sequence of taps correctly.
    expect(isAutoCancelTriggered(tally({ fath: 3, tanbih: 1 }), 3)).toBe(false);
    expect(isAutoCancelTriggered(tally({ fath: 3, talathum: 1 }), 3)).toBe(false);
  });

  it("does not re-trigger on an already cancelled question", () => {
    expect(isAutoCancelTriggered(tally({ cancelled: true, fath: 5 }), 3)).toBe(
      false,
    );
  });

  it("builds the judge-facing message with the Arabic ordinal", () => {
    expect(autoCancelMessage(3)).toBe("أي خطأ بعد الفتح الثالث يُلغي السؤال");
    expect(autoCancelMessage(11)).toBe("أي خطأ بعد الفتح رقم 11 يُلغي السؤال");
  });

  it("computeHifz auto-cancels a question once the rule triggers", () => {
    // 2 questions → 30 pts each. Question 1 crosses the threshold (fath=4)
    // and is written off whole; question 2 stays flawless.
    const result = computeHifz({
      ...hifzInput([tally({ fath: 4 }), emptyTally()]),
      autoCancelFathThreshold: 3,
    });
    expect(result.cancelledPenalty).toBe(30);
    expect(result.fathPenalty).toBe(0);
    expect(result.score).toBe(30);
  });
});

describe("isAutoCancelTriggeredByTap — order-aware, for live tallying", () => {
  it("is disabled when no threshold is configured", () => {
    expect(isAutoCancelTriggeredByTap(tally({ fath: 3 }), "tanbih", 1, null)).toBe(
      false,
    );
  });

  it("does not trigger a تنبيه tapped before فتح reaches the threshold", () => {
    // The exact bug this guards against: تنبيه tapped at fath=1, then فتح
    // catches up to 3 later — the earlier تنبيه must not retroactively cancel.
    expect(isAutoCancelTriggeredByTap(tally({ fath: 1 }), "tanbih", 1, 3)).toBe(
      false,
    );
  });

  it("does not trigger the فتح tap that only just reaches the threshold", () => {
    expect(isAutoCancelTriggeredByTap(tally({ fath: 2 }), "fath", 3, 3)).toBe(
      false,
    );
  });

  it("triggers a further فتح tap once فتح is already at the threshold", () => {
    expect(isAutoCancelTriggeredByTap(tally({ fath: 3 }), "fath", 4, 3)).toBe(
      true,
    );
  });

  it("triggers a تنبيه/تلعثم tap once فتح is already at the threshold", () => {
    expect(isAutoCancelTriggeredByTap(tally({ fath: 3 }), "tanbih", 1, 3)).toBe(
      true,
    );
    expect(
      isAutoCancelTriggeredByTap(tally({ fath: 3 }), "talathum", 1, 3),
    ).toBe(true);
  });

  it("ignores a decrement", () => {
    expect(
      isAutoCancelTriggeredByTap(tally({ fath: 3, tanbih: 2 }), "tanbih", 1, 3),
    ).toBe(false);
  });

  it("does not re-trigger on an already cancelled question", () => {
    expect(
      isAutoCancelTriggeredByTap(
        tally({ cancelled: true, fath: 3 }),
        "tanbih",
        1,
        3,
      ),
    ).toBe(false);
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
