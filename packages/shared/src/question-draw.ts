/**
 * Drawing questions inside a candidate's memorisation scope.
 *
 * A question is a starting verse plus how much the candidate must recite from
 * it (`amountUnit` × `amountValue`). Resolving where a passage *ends* needs page
 * and hizb boundaries, so that lives in the API against the database; here we
 * only choose the starting verses.
 *
 * Draws are seeded so an admin can regenerate the exact same paper — the seed is
 * stored on the competition.
 */

export type AmountUnit = "ayat" | "wajh" | "page" | "thumn_hizb" | "rub_hizb";

export const AMOUNT_UNIT_LABELS_AR: Record<AmountUnit, string> = {
  ayat: "آيات",
  wajh: "وجه",
  page: "صفحة",
  thumn_hizb: "ثمن حزب",
  rub_hizb: "ربع حزب",
};

/** Deterministic PRNG (mulberry32) so a given seed reproduces a given paper. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DrawOptions {
  startVerseId: number;
  endVerseId: number;
  count: number;
  /**
   * Verses reserved after each start so the passage has room to run before the
   * scope ends. Callers pass a conservative estimate of the passage length.
   */
  passageVerses: number;
  rng: () => number;
  /** Minimum verses between two drawn starts, to spread the paper out. */
  minSpacing?: number;
}

export class DrawError extends Error {}

/**
 * Choose `count` distinct starting verses inside the scope, left-to-right, each
 * with room for a full passage and separated by at least `minSpacing` verses.
 */
export function drawQuestionStarts(options: DrawOptions): number[] {
  const {
    startVerseId,
    endVerseId,
    count,
    passageVerses,
    rng,
    minSpacing = passageVerses,
  } = options;

  if (count < 1) throw new DrawError("count must be at least 1");
  if (endVerseId < startVerseId) throw new DrawError("empty scope");

  // The last verse a passage may start on and still fit inside the scope.
  const lastStart = Math.max(startVerseId, endVerseId - passageVerses + 1);
  const span = lastStart - startVerseId + 1;

  if (span < count) {
    throw new DrawError(
      `scope holds ${span} possible starts but ${count} questions were requested`,
    );
  }

  // Partition the scope into `count` equal buckets and draw one start per
  // bucket. This guarantees distinctness and spread in one pass, instead of
  // rejection-sampling until the spacing constraint happens to hold.
  const bucketSize = span / count;
  const starts: number[] = [];

  for (let i = 0; i < count; i++) {
    const bucketStart = startVerseId + Math.floor(i * bucketSize);
    const bucketEnd = startVerseId + Math.floor((i + 1) * bucketSize) - 1;

    const earliest = Math.max(
      bucketStart,
      starts.length ? starts[starts.length - 1] + minSpacing : bucketStart,
    );
    // When spacing pushes past the bucket, fall back to the bucket's own range
    // rather than drifting outside the scope.
    const low = Math.min(earliest, bucketEnd);
    const high = Math.max(low, bucketEnd);

    starts.push(low + Math.floor(rng() * (high - low + 1)));
  }

  return starts;
}
