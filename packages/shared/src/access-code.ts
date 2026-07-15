/**
 * The judge's typed `رمز التحقّق`.
 *
 * Eight characters from a 31-symbol alphabet (~10^12 combinations). That is far
 * below the QR token's 256 bits, so the code is only safe because it expires
 * within hours and the API throttles guesses. Never lengthen the expiry
 * without revisiting that trade-off.
 */

/** No 0/O/1/I/L: judges read these off a printed card, often badly lit. */
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_LENGTH = 8;

/** `ABCD-EFGH` — grouped for reading aloud and typing. */
export function formatAccessCode(code: string): string {
  const clean = normalizeAccessCode(code);
  if (clean.length !== ACCESS_CODE_LENGTH) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

/**
 * Fold what the judge typed onto the canonical form: upper-case, separators and
 * whitespace removed. Look-alike glyphs are deliberately *not* remapped — an `O`
 * could be a misread `Q` or `D`, and guessing would just waste one of the
 * client's throttled attempts on the wrong code. Anything outside the alphabet
 * fails `isAccessCodeShaped`, and the judge is asked to retype.
 */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isAccessCodeShaped(input: string): boolean {
  const clean = normalizeAccessCode(input);
  return (
    clean.length === ACCESS_CODE_LENGTH &&
    [...clean].every((c) => ACCESS_CODE_ALPHABET.includes(c))
  );
}
