/** Enums shared by the API, the dashboard and the mobile app. */

export const UserRole = {
  ADMIN: "ADMIN",
  JUDGE: "JUDGE",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

/** The spreadsheet writes gender as ذكر/أنثى for candidates, رجال/نساء for judges. */
export function parseGender(raw: string): Gender {
  const value = raw.trim();
  if (value.startsWith("ذكر") || value.startsWith("رجال")) return Gender.MALE;
  if (value.startsWith("أنثى") || value.startsWith("انثى") || value.startsWith("نساء")) {
    return Gender.FEMALE;
  }
  throw new Error(`Unrecognised gender: "${raw}"`);
}

export const CompetitionStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
} as const;
export type CompetitionStatus =
  (typeof CompetitionStatus)[keyof typeof CompetitionStatus];

export const JudgingStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  DRAFT_SAVED: "DRAFT_SAVED",
  SUBMITTED: "SUBMITTED",
} as const;
export type JudgingStatus = (typeof JudgingStatus)[keyof typeof JudgingStatus];

export const QuestionSource = {
  AUTO: "AUTO",
  MANUAL: "MANUAL",
  IMPORTED: "IMPORTED",
} as const;
export type QuestionSource =
  (typeof QuestionSource)[keyof typeof QuestionSource];

/** `PENALTY` is the hifz engine; `DIRECT` is a judge-entered 0..max rating. */
export const CriterionKind = {
  PENALTY: "PENALTY",
  DIRECT: "DIRECT",
} as const;
export type CriterionKind = (typeof CriterionKind)[keyof typeof CriterionKind];

export const ScopeKindValues = ["FULL", "SURA", "RANGE"] as const;
