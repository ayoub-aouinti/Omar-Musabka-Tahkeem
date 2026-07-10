/**
 * Parses the free-text memorisation scope each candidate declares in the
 * spreadsheet column `السّور المشارك بها` into a concrete verse range.
 *
 * Every one of the 45 distinct strings in the 2026 workbook is covered:
 *
 *   من النبأ إلى الناس            surah → surah
 *   من التّوبة 93 إلى النّاس       trailing ayah number
 *   من العنكبوت (اية 46) إلى النّاس parenthesised ayah number
 *   سورة البقرة                   a single surah
 *   كامل القرآن                    the whole mushaf
 *   من الصافات الى البقرة          reversed — candidates who memorise backwards
 *
 * A reversed range is not an error: reciters working from the end of the mushaf
 * write their scope end-first. The span is the same either way, so the endpoints
 * are ordered by mushaf position.
 */
import { surahKey, toWesternDigits } from "./arabic.js";

export interface SurahMeta {
  number: number;
  nameAr: string;
  firstVerseId: number;
  lastVerseId: number;
  /** ayah number within the surah → global verse id. */
  ayahToVerseId: Record<number, number>;
}

export interface QuranIndex {
  /** Keyed by `surahKey(nameAr)`. */
  byKey: Record<string, SurahMeta>;
  byNumber: Record<number, SurahMeta>;
  firstVerseId: number;
  lastVerseId: number;
}

export interface VerseRow {
  id: number;
  suraNumber: number;
  suraNameAr: string;
  ayaNumber: number;
}

export class ScopeParseError extends Error {
  constructor(
    public readonly raw: string,
    reason: string,
  ) {
    super(`Cannot parse scope "${raw}": ${reason}`);
    this.name = "ScopeParseError";
  }
}

export function buildQuranIndex(verses: VerseRow[]): QuranIndex {
  const byNumber: Record<number, SurahMeta> = {};

  for (const verse of verses) {
    let surah = byNumber[verse.suraNumber];
    if (!surah) {
      surah = byNumber[verse.suraNumber] = {
        number: verse.suraNumber,
        nameAr: verse.suraNameAr.trim(),
        firstVerseId: verse.id,
        lastVerseId: verse.id,
        ayahToVerseId: {},
      };
    }
    if (verse.id < surah.firstVerseId) surah.firstVerseId = verse.id;
    if (verse.id > surah.lastVerseId) surah.lastVerseId = verse.id;
    surah.ayahToVerseId[verse.ayaNumber] = verse.id;
  }

  const surahs = Object.values(byNumber);
  if (surahs.length === 0) throw new Error("Quran index built from zero verses");

  const byKey: Record<string, SurahMeta> = {};
  for (const surah of surahs) byKey[surahKey(surah.nameAr)] = surah;

  return {
    byKey,
    byNumber,
    firstVerseId: Math.min(...surahs.map((s) => s.firstVerseId)),
    lastVerseId: Math.max(...surahs.map((s) => s.lastVerseId)),
  };
}

export type ScopeKind = "FULL" | "SURA" | "RANGE";

export interface ParsedScope {
  raw: string;
  kind: ScopeKind;
  startVerseId: number;
  endVerseId: number;
  /** The candidate wrote the endpoints end-first; we reordered them. */
  reversed: boolean;
}

const FULL_QURAN_KEY = surahKey("كامل القرآن");
const SINGLE_SURAH_RE = /^سورة\s+(.+)$/;
const RANGE_RE = /^من\s+(.+?)\s+(?:إلى|الى|الي)\s+(.+)$/;
const PAREN_AYAH_RE = /\(\s*[اأآ]ية\s*(\d+)\s*\)/;
const TRAILING_AYAH_RE = /(\d+)\s*$/;

interface Endpoint {
  surah: SurahMeta;
  /** Explicit ayah number, when the candidate pinned one. */
  ayahVerseId: number | null;
}

function resolveSurah(index: QuranIndex, name: string): SurahMeta {
  const key = surahKey(name.replace(/^سورة\s+/, "").trim());

  const exact = index.byKey[key];
  if (exact) return exact;

  // `الصافات` vs `الصّافات` already fold together, but a candidate may clip a
  // trailing word. Accept a prefix match only when it is unambiguous.
  const matches = Object.entries(index.byKey).filter(
    ([candidate]) => candidate.startsWith(key) || key.startsWith(candidate),
  );
  if (matches.length === 1) return matches[0][1];

  throw new Error(
    matches.length === 0
      ? `unknown surah "${name}"`
      : `ambiguous surah "${name}" (${matches.length} matches)`,
  );
}

function parseEndpoint(index: QuranIndex, rawText: string): Endpoint {
  let text = toWesternDigits(rawText).trim();
  let ayah: number | null = null;

  const paren = text.match(PAREN_AYAH_RE);
  if (paren) {
    ayah = Number(paren[1]);
    text = text.slice(0, paren.index).trim();
  } else {
    const trailing = text.match(TRAILING_AYAH_RE);
    if (trailing) {
      ayah = Number(trailing[1]);
      text = text.slice(0, trailing.index).trim();
    }
  }

  const surah = resolveSurah(index, text);

  if (ayah === null) return { surah, ayahVerseId: null };

  const verseId = surah.ayahToVerseId[ayah];
  if (verseId === undefined) {
    throw new Error(`surah ${surah.nameAr.trim()} has no ayah ${ayah}`);
  }
  return { surah, ayahVerseId: verseId };
}

const startOf = (e: Endpoint) => e.ayahVerseId ?? e.surah.firstVerseId;
const endOf = (e: Endpoint) => e.ayahVerseId ?? e.surah.lastVerseId;

export function parseScope(raw: string, index: QuranIndex): ParsedScope {
  const text = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) throw new ScopeParseError(raw, "empty");

  if (surahKey(text) === FULL_QURAN_KEY) {
    return {
      raw: text,
      kind: "FULL",
      startVerseId: index.firstVerseId,
      endVerseId: index.lastVerseId,
      reversed: false,
    };
  }

  const single = text.match(SINGLE_SURAH_RE);
  if (single) {
    try {
      const surah = resolveSurah(index, single[1]);
      return {
        raw: text,
        kind: "SURA",
        startVerseId: surah.firstVerseId,
        endVerseId: surah.lastVerseId,
        reversed: false,
      };
    } catch (error) {
      throw new ScopeParseError(raw, (error as Error).message);
    }
  }

  const range = text.match(RANGE_RE);
  if (!range) throw new ScopeParseError(raw, "unrecognised format");

  let from: Endpoint;
  let to: Endpoint;
  try {
    from = parseEndpoint(index, range[1]);
    to = parseEndpoint(index, range[2]);
  } catch (error) {
    throw new ScopeParseError(raw, (error as Error).message);
  }

  let startVerseId = startOf(from);
  let endVerseId = endOf(to);
  let reversed = false;

  if (startVerseId > endVerseId) {
    // Written end-first. Re-derive the span with the endpoints swapped: an
    // unpinned endpoint flips between the surah's first and last verse.
    reversed = true;
    startVerseId = startOf(to);
    endVerseId = endOf(from);
  }

  if (startVerseId > endVerseId) {
    throw new ScopeParseError(raw, "endpoints do not form a range");
  }

  return { raw: text, kind: "RANGE", startVerseId, endVerseId, reversed };
}

/** Parse without throwing — used by the bulk importer to collect bad rows. */
export function tryParseScope(
  raw: string,
  index: QuranIndex,
): { ok: true; scope: ParsedScope } | { ok: false; error: string } {
  try {
    return { ok: true, scope: parseScope(raw, index) };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
