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

export interface Criterion {
  id: string;
  key: string;
  labelAr: string;
  descriptionAr: string | null;
  kind: CriterionKind;
  maxPoints: number;
  sortOrder: number;
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
}

export interface ScoringConfig {
  hifzBase: number;
  weights: {
    talathum: number;
    tanbih: number;
    fath: number;
  };
  directCriteria: Array<{
    id: string;
    key: string;
    labelAr: string;
    maxPoints: number;
  }>;
}

/** Payload for PUT /competitions/:id/scoring. */
export interface ScoringCriterionInput {
  key: string;
  labelAr: string;
  descriptionAr?: string;
  kind: CriterionKind;
  maxPoints: number;
  sortOrder?: number;
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

export interface QuestionCreate {
  competitionId: string;
  categoryId?: string;
  candidateId?: string;
  startVerseId: number;
  amountUnit: AmountUnit;
  amountValue: number;
}

export interface PassageVerse {
  id: number;
  ayaText: string;
  ayaNumber: number;
  suraNameAr: string;
  page: number;
}

export interface QuestionPassage {
  question: CandidateQuestion;
  verses: PassageVerse[];
  label: string;
  pages: number[];
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

/** Shape the API uses for validation / auth failures. */
export interface ApiErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}
