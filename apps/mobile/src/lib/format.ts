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

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `mm:ss`, growing to `h:mm:ss` past the hour. A judging session runs minutes,
 * but a card is valid for hours — `475:55` was the same clock rendering both.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const clock = hours
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
  return toDisplayDigits(clock);
}

/** A session's remaining life, e.g. `3:59:12` or «انتهت الصلاحية». */
export function formatCountdown(remainingSeconds: number | null): string {
  if (remainingSeconds == null) return "—";
  if (remainingSeconds <= 0) return "انتهت الصلاحية";
  return formatClock(remainingSeconds);
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
