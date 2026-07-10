/**
 * Wire types for the tahkeem API, mirrored from `apps/api`. Shared enums and the
 * scoring types come from `@tahkeem/shared`; only the transport shapes live here.
 */
import type {
  CompetitionScore,
  HifzBreakdown,
  JudgingStatus,
  PenaltyWeights,
} from "@tahkeem/shared";

export type { JudgingStatus, PenaltyWeights, CompetitionScore, HifzBreakdown };

export type UserRole = "ADMIN" | "JUDGE";
export type Gender = "MALE" | "FEMALE";

/** The authenticated principal, normalised across `/auth/*` and `/auth/me`. */
export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  judgeId?: string;
  competitionId?: string;
  /** ISO string; present only for QR-issued judge tokens. */
  expiresAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

/** `/auth/me` returns the raw JWT payload (`sub` instead of `id`). */
export interface MePayload {
  sub: string;
  name: string;
  role: UserRole;
  judgeId?: string;
  competitionId?: string;
}

export interface Category {
  id: string;
  labelAr: string;
  hizbCount: number;
  questionCount: number;
}

export interface CandidateSessionSummary {
  id: string;
  status: JudgingStatus;
  totalScore: number | null;
}

export interface CandidateListItem {
  id: string;
  externalId: number | null;
  fullName: string;
  gender: Gender;
  birthDate: string | null;
  teacherName: string | null;
  scopeRaw: string;
  scopeReversed: boolean;
  category: Category;
  judgingSessions: CandidateSessionSummary[];
}

// ── open-session payload ──

export interface QuestionResultRecord {
  id: string;
  questionId: string;
  talathumCount: number;
  tanbihCount: number;
  fathCount: number;
  cancelled: boolean;
  /** اعتماد تقييم السؤال locked this in; a draft row is false. */
  confirmed: boolean;
}

export interface CriterionScoreRecord {
  id: string;
  criterionId: string;
  value: number;
}

export interface SessionRecord {
  id: string;
  status: JudgingStatus;
  notes: string | null;
  questionResults: QuestionResultRecord[];
  criterionScores: CriterionScoreRecord[];
}

export interface QuestionMeta {
  id: string;
  startVerseId: number;
  endVerseId: number;
  amountUnit: string;
  amountValue: number;
  sortOrder: number;
}

export interface Verse {
  id: number;
  ayaText: string;
  ayaNumber: number;
  suraNameAr: string;
  suraNumber: number;
  page: string;
  jozz: number;
  hizbNumber: number;
}

/** A verse on the full mushaf page, flagged for highlight and surah opening. */
export interface PageVerse {
  id: number;
  suraNumber: number;
  suraNameAr: string;
  ayaNumber: number;
  ayaText: string;
  page: string;
  jozz: number;
  hizbNumber: number;
  /** Inside the question's span — shown shaded. */
  highlighted: boolean;
  /** Opens a surah on this page — a decorated band precedes it. */
  startsSurah: boolean;
}

export interface QuestionPage {
  pages: string[];
  firstPage: number;
  lastPage: number;
  verses: PageVerse[];
}

export interface QuestionPassage {
  question: QuestionMeta;
  /** The full mushaf page(s), with the question highlighted. */
  page: QuestionPage;
  /** The passage span only. */
  verses: Verse[];
  label: string;
  pages: string[];
}

export interface DirectCriterion {
  id: string;
  key: string;
  labelAr: string;
  maxPoints: number;
}

export interface ScoringConfig {
  hifzBase: number;
  weights: PenaltyWeights;
  directCriteria: DirectCriterion[];
  questionCount: number;
  pointsPerQuestion: number;
}

export interface OpenSessionCandidate {
  id: string;
  fullName: string;
  scopeRaw: string;
  category: Category;
}

export interface OpenSessionResponse {
  session: SessionRecord;
  candidate: OpenSessionCandidate;
  questions: QuestionPassage[];
  scoring: ScoringConfig;
}

// ── submit ──

export interface SubmitQuestion {
  questionId: string;
  talathumCount: number;
  tanbihCount: number;
  fathCount: number;
  cancelled: boolean;
  /** true = اعتماد تقييم السؤال, false = حفظ كمسودّة. */
  confirmed?: boolean;
}

export interface SubmitCriterionScore {
  criterionId: string;
  value: number;
}

export interface SubmitBody {
  sessionId: string;
  questions: SubmitQuestion[];
  criterionScores: SubmitCriterionScore[];
  notes?: string;
  finalize: boolean;
}

export interface SubmitResponse {
  sessionId: string;
  finalized: boolean;
  score: CompetitionScore;
}
