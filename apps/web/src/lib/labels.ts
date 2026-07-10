import { toArabicDigits } from "@tahkeem/shared";
import type {
  AmountUnit,
  CompetitionStatus,
  Gender,
  JudgingStatus,
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

/** Format a "quantity + unit" the way the workbook reads it, in Arabic digits. */
export function formatAmount(value: number, unit: AmountUnit): string {
  return `${toArabicDigits(value)} ${AMOUNT_UNIT_LABELS[unit]}`;
}

/** Localised date (Gregorian) for display; returns a dash for missing dates. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return toArabicDigits(
    new Intl.DateTimeFormat("ar-TN-u-ca-gregory", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date),
  );
}
