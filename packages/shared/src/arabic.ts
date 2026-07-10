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

/** Render an ASCII number with Arabic-Indic digits (٠-٩). */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

/**
 * The numeral form the interface renders. The branch reads scores, identifiers
 * and counts in Western digits, so every number the UI prints goes through here
 * rather than being interpolated raw — switching the whole product to Arabic-
 * Indic later is then a one-line change.
 */
export function toDisplayDigits(value: number | string): string {
  return toWesternDigits(String(value));
}

/** BCP-47 extension forcing `Intl` to emit Western digits under an `ar-*` locale. */
export const DISPLAY_NUMBERING = "-u-nu-latn";
