import { toDisplayDigits } from "@tahkeem/shared";

export { toDisplayDigits };

/** Trim a score to at most two decimals, dropping trailing zeros (`40.50` -> `40.5`). */
export function formatScore(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return String(rounded);
}

/** A signed deduction, e.g. `-0.5`. Zero renders as `0` (no minus sign). */
export function formatDeduction(value: number): string {
  if (value === 0) return "0";
  return `−${formatScore(value)}`;
}

/** `mm:ss` from a whole-second elapsed count. */
export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return toDisplayDigits(`${pad(minutes)}:${pad(seconds)}`);
}

/** ISO date -> `dd/mm/yyyy`, or empty string. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return toDisplayDigits(`${day}/${month}/${year}`);
}
