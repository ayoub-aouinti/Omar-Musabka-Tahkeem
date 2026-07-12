import { toDisplayDigits } from "@tahkeem/shared";
import type {
  AmountUnit,
  CompetitionStatus,
  Difficulty,
  Gender,
  JudgingStatus,
  QuestionSource,
} from "../types";

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "ذكر",
  FEMALE: "أنثى",
};

export const STATUS_LABELS: Record<CompetitionStatus, string> = {
  DRAFT: "مسودّة",
  ACTIVE: "نشطة",
  PAUSED: "متوقّفة",
  COMPLETED: "منتهية",
};

/** Tailwind classes for a status chip, keyed by competition status. */
export const STATUS_CHIP: Record<CompetitionStatus, string> = {
  DRAFT: "bg-surface-container-highest text-on-surface-variant",
  ACTIVE: "bg-primary-container text-on-primary",
  PAUSED: "bg-error-container text-on-error-container",
  COMPLETED: "bg-secondary-container text-on-secondary-container",
};

export const JUDGING_STATUS_LABELS: Record<JudgingStatus, string> = {
  PENDING: "لم يبدأ",
  IN_PROGRESS: "قيد التحكيم",
  DRAFT_SAVED: "مسودّة محفوظة",
  SUBMITTED: "مُعتمد",
};

export const AMOUNT_UNIT_LABELS: Record<AmountUnit, string> = {
  ayat: "آيات",
  wajh: "وجه",
  page: "صفحة",
  thumn_hizb: "ثمن حزب",
  rub_hizb: "ربع حزب",
};

export const AMOUNT_UNITS: AmountUnit[] = [
  "ayat",
  "wajh",
  "page",
  "thumn_hizb",
  "rub_hizb",
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "سهل",
  MEDIUM: "متوسط",
  HARD: "صعب",
};

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

/** Tailwind classes for a difficulty chip: green-ish / neutral / red-ish. */
export const DIFFICULTY_CHIP: Record<Difficulty, string> = {
  EASY: "bg-primary-container text-on-primary",
  MEDIUM: "bg-surface-container-highest text-on-surface-variant",
  HARD: "bg-error-container text-on-error-container",
};

export const SOURCE_LABELS: Record<QuestionSource, string> = {
  AUTO: "تلقائي",
  MANUAL: "يدوي",
  IMPORTED: "مستورد",
};

export const SOURCES: QuestionSource[] = ["AUTO", "MANUAL", "IMPORTED"];

/** Format a "quantity + unit" the way the workbook reads it, in Arabic digits. */
export function formatAmount(value: number, unit: AmountUnit): string {
  return `${toDisplayDigits(value)} ${AMOUNT_UNIT_LABELS[unit]}`;
}

/** Localised date (Gregorian) for display; returns a dash for missing dates. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return toDisplayDigits(
    new Intl.DateTimeFormat("ar-TN-u-ca-gregory", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date),
  );
}
