/**
 * Arabic text normalisation used to match the surah names written by hand in the
 * competition spreadsheet against the fully-vocalised names in the Qaloun mushaf
 * dataset (e.g. `الرَّحمٰن` vs `الرحمان`, `يسٓ` vs `يس`, `النَّبَإ` vs `النبأ`).
 */

/** Harakat, Quranic annotation marks, superscript alef and tatweel. */
const DIACRITICS = /[ً-ٰٕۖ-ۭـ]/g;

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Surah names whose spelling differs by a letter rather than by a diacritic, so
 * stripping marks alone never makes them equal.
 */
const SPELLING_ALIASES: Record<string, string> = {
  الرحمان: "الرحمن",
};

/** Strip marks and fold the letters that Arabic typists use interchangeably. */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise, then resolve known alternate spellings to one canonical key. */
export function surahKey(input: string): string {
  const normalized = normalizeArabic(input);
  return SPELLING_ALIASES[normalized] ?? normalized;
}

/** Convert Arabic-Indic digits (٠-٩) to ASCII so `parseInt` can read them. */
export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

/** Render an ASCII number with Arabic-Indic digits, for display only. */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}
