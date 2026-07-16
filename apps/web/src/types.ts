/**
 * API response types for the admin dashboard. These mirror the JSON the NestJS
 * API returns; enum unions are re-exported from `@tahkeem/shared` so the wire
 * shapes and the scoring engine never drift apart.
 */
import type {
  CompetitionStatus,
  CriterionKind,
  Gender,
  JudgingStatus,
  ScopeKind,
  UserRole,
} from "@tahkeem/shared";

export type {
  CompetitionStatus,
  CriterionKind,
  Gender,
  JudgingStatus,
  ScopeKind,
  UserRole,
};

/** Amount units used for question generation, in workbook order. */
export type AmountUnit = "ayat" | "wajh" | "page" | "thumn_hizb" | "rub_hizb";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  judgeId?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface CompetitionCounts {
  candidates: number;
  categories: number;
}

export interface CompetitionSummary {
  id: string;
  name: string;
  location: string | null;
  status: CompetitionStatus;
  startDate: string | null;
  drawSeed: string | null;
  _count: CompetitionCounts;
}

/** A descriptive points band inside a scale (e.g. 8–10 نقاط + وصف). */
export interface CriterionBand {
  id: string;
  minPoints: number;
  maxPoints: number;
  descriptionAr: string | null;
  sortOrder: number;
}

/** A per-hizb-range scale attached to a DIRECT criterion. */
export interface CriterionScale {
  id: string;
  labelAr: string;
  minHizb: number;
  maxHizb: number;
  maxPoints: number;
  sortOrder: number;
  bands: CriterionBand[];
}

export interface Criterion {
  id: string;
  key: string;
  labelAr: string;
  descriptionAr: string | null;
  kind: CriterionKind;
  maxPoints: number;
  sortOrder: number;
  scales?: CriterionScale[];
}

export interface PenaltyRule {
  id: string;
  kind: "TALATHUM" | "TANBIH" | "FATH";
  labelAr: string;
  weight: number;
}

export interface Category {
  id: string;
  competitionId: string;
  hizbCount: number;
  labelAr: string;
  questionCount: number;
  amountUnit: AmountUnit;
  amountValue: number;
  _count?: { candidates: number };
}

export interface CompetitionDetail extends CompetitionSummary {
  endDate: string | null;
  criteria: Criterion[];
  penaltyRules: PenaltyRule[];
  categories: Category[];
  /** فتح threshold for the auto-cancel rule; null when disabled. */
  autoCancelFathThreshold: number | null;
}

export interface ScoringConfig {
  hifzBase: number;
  weights: {
    talathum: number;
    tanbih: number;
    fath: number;
  };
  autoCancelFathThreshold: number | null;
  directCriteria: Array<{
    id: string;
    key: string;
    labelAr: string;
    maxPoints: number;
  }>;
}

/** Payload for PUT /competitions/:id/scoring. */
export interface ScoringBandInput {
  minPoints: number;
  maxPoints: number;
  descriptionAr: string;
}

export interface ScoringScaleInput {
  labelAr: string;
  minHizb: number;
  maxHizb: number;
  maxPoints: number;
  bands?: ScoringBandInput[];
}

export interface ScoringCriterionInput {
  key: string;
  labelAr: string;
  descriptionAr?: string;
  kind: CriterionKind;
  maxPoints: number;
  sortOrder?: number;
  scales?: ScoringScaleInput[];
}

export interface ScoringPenaltyInput {
  kind: "TALATHUM" | "TANBIH" | "FATH";
  labelAr: string;
  weight: number;
}

export interface ScoringUpdate {
  criteria: ScoringCriterionInput[];
  penaltyRules: ScoringPenaltyInput[];
}

export interface CategoryUpsert {
  hizbCount: number;
  labelAr: string;
  questionCount: number;
  amountUnit: AmountUnit;
  amountValue: number;
}

export interface CompetitionCreate {
  name: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}

export interface JudgingSessionRef {
  id: string;
  status: JudgingStatus;
  judgeId: string;
}

export interface CandidateListItem {
  id: string;
  externalId: string | null;
  fullName: string;
  gender: Gender;
  birthDate: string | null;
  teacherName: string | null;
  scopeRaw: string;
  scopeReversed: boolean;
  category: { id: string; labelAr: string; hizbCount: number };
  judgingSessions: JudgingSessionRef[];
  /** Present when the candidate has explicit (overriding) judges assigned. */
  explicitJudgeCount?: number;
}

export interface CandidateList {
  items: CandidateListItem[];
  total: number;
  take: number;
  skip: number;
}

export interface ScopeEndpoint {
  surah: string;
  ayah: number;
  page: number;
}

export interface ResolvedScope {
  raw: string;
  kind: ScopeKind;
  reversed: boolean;
  verseCount: number;
  start: ScopeEndpoint;
  end: ScopeEndpoint;
}

export interface CandidateQuestion {
  id: string;
  candidateId: string | null;
  categoryId: string | null;
  competitionId: string;
  startVerseId: number;
  amountUnit: AmountUnit;
  amountValue: number;
  source: string;
  label?: string;
  orderIndex?: number;
}

export interface CandidateDetail {
  id: string;
  externalId: string | null;
  fullName: string;
  gender: Gender;
  birthDate: string | null;
  teacherName: string | null;
  scopeRaw: string;
  scopeReversed: boolean;
  competitionId: string;
  category: { id: string; labelAr: string; hizbCount: number };
  questions: CandidateQuestion[];
  scope: {
    raw: string;
    kind: ScopeKind;
    reversed: boolean;
    verseCount: number;
    start: ScopeEndpoint;
    end: ScopeEndpoint;
  };
}

export interface CandidateCreate {
  competitionId: string;
  categoryId: string;
  externalId?: string;
  fullName: string;
  gender: Gender;
  birthDate?: string;
  teacherName?: string;
  scopeRaw: string;
}

export type CandidateUpdate = Partial<Omit<CandidateCreate, "competitionId">>;

/** GET /quran/scope response (raw, un-nested to top level). */
export interface QuranScopeResult {
  kind: ScopeKind;
  reversed: boolean;
  verseCount: number;
  startVerseId: number;
  endVerseId: number;
  start: ScopeEndpoint;
  end: ScopeEndpoint;
}

export interface Surah {
  number: number;
  nameAr: string;
  firstVerseId: number;
  lastVerseId: number;
  ayahCount: number;
}

export interface AccessSession {
  id: string;
  displayCode: string;
  expiresAt: string;
  consumedAt: string | null;
  competitionId: string;
}

export interface Judge {
  id: string;
  externalNo: number | null;
  fullName: string;
  gender: Gender;
  residence: string | null;
  accessSessions: AccessSession[];
  _count: { judgingSessions: number };
}

export interface JudgeCreate {
  fullName: string;
  gender: Gender;
  residence?: string;
  externalNo?: number;
}

export type JudgeUpdate = Partial<JudgeCreate>;

export interface AccessGrant {
  id: string;
  /** Non-secret support reference, e.g. QX-9902. */
  displayCode: string;
  expiresAt: string;
  /** The QR payload. Secret; returned once. */
  token: string;
  /** The typed `رمز التحقّق`, e.g. ABCD-EFGH. Secret; returned once. */
  accessCode: string;
  qrDataUrl: string;
}

export interface AccessSessionWithJudge extends AccessSession {
  judge: { id: string; fullName: string; gender: Gender };
}

export interface JudgeStats {
  totalJudges: number;
  activeSessions: number;
  expiredSessions: number;
}

export interface CategoryGenerateResult {
  generated: number;
  failed: Array<{ candidate: string; reason: string }>;
}

/* --------------------------- Question bank -------------------------------- */

/** Difficulty tiers for a question (Arabic: سهل/متوسط/صعب). */
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

/** How a question came to exist (Arabic: تلقائي/يدوي/مستورد). */
export type QuestionSource = "AUTO" | "MANUAL" | "IMPORTED";

export interface BankQuestion {
  id: string;
  competitionId: string;
  categoryId: string | null;
  candidateId: string | null;
  source: QuestionSource;
  difficulty: Difficulty;
  sortOrder: number;
  startVerseId: number;
  endVerseId: number;
  amountUnit: AmountUnit;
  amountValue: number;
  candidate: { id: string; fullName: string; externalId: string | null } | null;
  category: { id: string; labelAr: string; hizbCount: number } | null;
  startRef: ScopeEndpoint;
  endRef: ScopeEndpoint;
  verseCount: number;
}

export interface QuestionBankResult {
  items: BankQuestion[];
  total: number;
  take: number;
  skip: number;
}

export interface QuestionCreate {
  competitionId: string;
  categoryId?: string;
  candidateId?: string;
  startVerseId: number;
  amountUnit: AmountUnit;
  amountValue: number;
  difficulty?: Difficulty;
}

export interface QuestionUpdate {
  startVerseId?: number;
  amountUnit?: AmountUnit;
  amountValue?: number;
  difficulty?: Difficulty;
}

/** A single verse within a rendered mushaf page. */
export interface PassageVerse {
  id: number;
  suraNumber: number;
  suraNameAr: string;
  ayaNumber: number;
  ayaText: string;
  page: number;
  jozz: number;
  hizbNumber: number;
  highlighted: boolean;
  startsSurah: boolean;
}

/** The full mushaf page(s) with the question span flagged. */
export interface PassagePage {
  pages: string[];
  firstPage: number;
  lastPage: number;
  verses: PassageVerse[];
}

export interface QuestionPassage {
  question: CandidateQuestion;
  page: PassagePage;
  verses: PassageVerse[];
  label: string;
  pages: string[];
}

/** A verse row from GET /quran/verses (inclusive slice). */
export interface QuranVerse {
  id: number;
  ayaText: string;
  ayaNumber: number;
  suraNameAr: string;
  suraNumber: number;
  page: number;
  jozz: number;
  hizbNumber: number;
}

export interface ImportReport {
  dryRun: boolean;
  candidates: { imported: number; skipped: number };
  judges: { imported: number };
  categoriesCreated: number[];
  errors: Array<{ row: number; name: string; reason: string }>;
}

export interface ResultRow {
  candidate: { id: string; fullName: string; categoryId: string };
  judgeCount: number;
  averageScore: number;
}

export interface CandidateReportQuestion {
  id: string;
  label: string;
  maxScore: number;
  averageScore: number | null;
}

export interface CandidateReportCriterion {
  id: string;
  labelAr: string;
  maxPoints: number;
  averageValue: number | null;
}

export interface CandidateReportNote {
  judge: { id: string; fullName: string };
  notes: string;
}

export interface CandidateReportJudge {
  id: string;
  fullName: string;
  durationMinutes: number | null;
}

export interface CandidateReport {
  candidate: {
    id: string;
    fullName: string;
    gender: Gender;
    teacherName: string | null;
    scopeRaw: string;
    externalId: number | null;
    category: { id: string; labelAr: string; hizbCount: number };
  };
  competition: { id: string; name: string };
  judges: CandidateReportJudge[];
  judgeCount: number;
  averageScore: number;
  maxTotal: number;
  finalScoreOn20: number;
  hifzBase: number;
  questions: CandidateReportQuestion[];
  criteria: CandidateReportCriterion[];
  notes: CandidateReportNote[];
}

/* --------------------- Judge ↔ candidate assignment ----------------------- */

/** A judge directly assigned to a candidate (overriding their category). */
export interface CandidateJudge {
  id: string;
  fullName: string;
  gender: Gender;
}

export interface AssignJudgeResult {
  assigned: number;
}

/** Shape the API uses for validation / auth failures. */
export interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}
