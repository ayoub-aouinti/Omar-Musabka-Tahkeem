import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { normalizeArabic, surahKey } from "../arabic";
import {
  buildQuranIndex,
  parseScope,
  type QuranIndex,
  ScopeParseError,
  type VerseRow,
} from "../quran-scope";

const QURAN_JSON = join(
  __dirname,
  "../../../../apps/api/prisma/data/quran-qaloun-v2-1.json",
);

let index: QuranIndex;

beforeAll(() => {
  const verses = JSON.parse(readFileSync(QURAN_JSON, "utf8")) as VerseRow[];
  index = buildQuranIndex(verses);
});

describe("normalizeArabic", () => {
  it("folds diacritics, alef forms, ta marbuta and alef maqsura", () => {
    expect(normalizeArabic("النِّسَاء")).toBe("النساء");
    expect(normalizeArabic("النّساء")).toBe("النساء");
    expect(normalizeArabic("الأحقَاف")).toBe("الاحقاف");
    expect(normalizeArabic("الجُمعَة")).toBe("الجمعه");
  });

  it("strips the superscript alef of الرَّحمٰن and the maddah of يسٓ", () => {
    expect(normalizeArabic("الرَّحمٰن")).toBe("الرحمن");
    expect(normalizeArabic("يسٓ")).toBe("يس");
  });

  it("maps the الرحمان spelling onto the mushaf's الرحمن", () => {
    expect(surahKey("الرحمان")).toBe(surahKey("الرَّحمٰن"));
  });

  it("keeps آل عمران intact rather than eating the ال", () => {
    expect(normalizeArabic("آل عِمران")).toBe("ال عمران");
    expect(surahKey("آل عمران")).toBe(surahKey("آل عِمران "));
  });
});

describe("buildQuranIndex", () => {
  it("indexes all 114 surahs of the Qaloun dataset", () => {
    expect(Object.keys(index.byNumber)).toHaveLength(114);
    expect(Object.keys(index.byKey)).toHaveLength(114);
    expect(index.firstVerseId).toBe(1);
  });
});

/**
 * Every distinct value of `السّور المشارك بها` across the 405 candidates in the
 * 2026 workbook. If a future workbook adds a form, this list is where it lands.
 */
const REAL_SCOPES: Array<[string, number]> = [
  ["من النبأ إلى الناس", 61],
  ["من الأحقاف إلى النّاس", 59],
  ["من الجن إلى الناس", 56],
  ["من الملك إلى الناس", 44],
  ["من الرحمان إلى المرسلات", 28],
  ["من الصافات إلى الناس", 25],
  ["من الجمعة إلى الناس", 23],
  ["من العنكبوت (اية 46) إلى النّاس", 14],
  ["من مريم إلى النّاس", 10],
  ["من المجادلة إلى الطارق", 7],
  ["من الأعراف إلى النّاس", 6],
  ["من النّور إلى النّاس", 6],
  ["كامل القرآن", 6],
  ["من التّوبة 93 إلى النّاس", 5],
  ["من يس إلى الطارق", 5],
  ["من الرحمان إلى الصف", 5],
  ["من الفتح إلى التحريم", 4],
  ["من الرعد إلى الناس", 3],
  ["من النّساء 148 إلى النّاس", 2],
  ["من الجمعة إلى المرسلات", 2],
  ["من الأحقاف إلى الحديد", 2],
  ["من الفاتحة إلى الكهف 74", 2],
  ["من الفاتحة إلى النّساء", 2],
  ["من الأحقاف إلى الصف", 2],
  ["من الصافات الى البقرة", 2],
  ["من الجمعة إلى نوح", 2],
  ["من الفاتحة إلى الصافات", 2],
  ["من الذاريات إلى نوح", 2],
  ["من الفاتحة إلى الجاثية", 2],
  ["من آل عمران إلى النّاس", 1],
  ["من الزمر إلى آل عمران", 1],
  ["سورة البقرة", 1],
  ["من الفاتحة إلى التّوبة", 1],
  ["من الرعد إلى الكهف", 1],
  ["من مريم إلى الصّافات", 1],
  ["من الرحمان إلى التحريم", 1],
  ["من يس إلى النساء 56", 1],
  ["من الصّافات إلى النّساء", 1],
  ["من الفاتحة إلى الانعام", 1],
  ["من الفتح إلى الصف", 1],
  ["من فصّلت إلى المرسلات", 1],
  ["من المجادلة إلى المرسلات", 1],
  ["من الأحقاف إلى النساء", 1],
  ["من الفتح إلى الحديد", 1],
  ["من الذاريات إلى التحريم", 1],
];

describe("parseScope — every scope string in the 2026 workbook", () => {
  it("covers all 405 candidate rows", () => {
    const rows = REAL_SCOPES.reduce((sum, [, count]) => sum + count, 0);
    expect(rows).toBe(405);
  });

  it.each(REAL_SCOPES)("resolves %s", (raw) => {
    const scope = parseScope(raw, index);
    expect(scope.startVerseId).toBeGreaterThanOrEqual(1);
    expect(scope.endVerseId).toBeGreaterThanOrEqual(scope.startVerseId);
    expect(scope.endVerseId).toBeLessThanOrEqual(index.lastVerseId);
  });
});

describe("parseScope — forms", () => {
  it("treats كامل القرآن as the whole mushaf", () => {
    const scope = parseScope("كامل القرآن", index);
    expect(scope.kind).toBe("FULL");
    expect(scope.startVerseId).toBe(index.firstVerseId);
    expect(scope.endVerseId).toBe(index.lastVerseId);
  });

  it("treats سورة البقرة as exactly that surah", () => {
    const scope = parseScope("سورة البقرة", index);
    const baqara = index.byNumber[2];
    expect(scope.kind).toBe("SURA");
    expect(scope.startVerseId).toBe(baqara.firstVerseId);
    expect(scope.endVerseId).toBe(baqara.lastVerseId);
  });

  it("honours a trailing ayah number on the start", () => {
    const scope = parseScope("من التّوبة 93 إلى النّاس", index);
    expect(scope.startVerseId).toBe(index.byNumber[9].ayahToVerseId[93]);
    expect(scope.endVerseId).toBe(index.byNumber[114].lastVerseId);
  });

  it("honours a trailing ayah number on the end", () => {
    const scope = parseScope("من الفاتحة إلى الكهف 74", index);
    expect(scope.startVerseId).toBe(index.firstVerseId);
    expect(scope.endVerseId).toBe(index.byNumber[18].ayahToVerseId[74]);
  });

  it("honours a parenthesised ayah number", () => {
    const scope = parseScope("من العنكبوت (اية 46) إلى النّاس", index);
    expect(scope.startVerseId).toBe(index.byNumber[29].ayahToVerseId[46]);
  });

  it("reorders a backwards range and flags it", () => {
    // الصافات is surah 37, البقرة is surah 2 — written end-first.
    const scope = parseScope("من الصافات الى البقرة", index);
    expect(scope.reversed).toBe(true);
    expect(scope.startVerseId).toBe(index.byNumber[2].firstVerseId);
    expect(scope.endVerseId).toBe(index.byNumber[37].lastVerseId);
  });

  it("keeps a pinned ayah when reordering a backwards range", () => {
    // من يس (36) إلى النساء 56 (4:56) → النساء:56 .. end of يس
    const scope = parseScope("من يس إلى النساء 56", index);
    expect(scope.reversed).toBe(true);
    expect(scope.startVerseId).toBe(index.byNumber[4].ayahToVerseId[56]);
    expect(scope.endVerseId).toBe(index.byNumber[36].lastVerseId);
  });

  it("accepts الى without the hamza", () => {
    expect(() => parseScope("من الجمعة الى الناس", index)).not.toThrow();
  });

  it("rejects an unknown surah", () => {
    expect(() => parseScope("من كذا إلى الناس", index)).toThrow(ScopeParseError);
  });

  it("rejects an ayah the surah does not have", () => {
    expect(() => parseScope("من الفاتحة 99 إلى الناس", index)).toThrow(
      /no ayah 99/,
    );
  });

  it("rejects an unrecognised format", () => {
    expect(() => parseScope("حزب عم", index)).toThrow(/unrecognised format/);
  });
});
