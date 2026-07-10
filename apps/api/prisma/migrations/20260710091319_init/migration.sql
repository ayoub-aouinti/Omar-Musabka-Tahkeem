-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'JUDGE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CriterionKind" AS ENUM ('PENALTY', 'DIRECT');

-- CreateEnum
CREATE TYPE "PenaltyKind" AS ENUM ('TALATHUM', 'TANBIH', 'FATH');

-- CreateEnum
CREATE TYPE "ScopeKind" AS ENUM ('FULL', 'SURA', 'RANGE');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('AUTO', 'MANUAL', 'IMPORTED');

-- CreateEnum
CREATE TYPE "JudgingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DRAFT_SAVED', 'SUBMITTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'JUDGE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judges" (
    "id" TEXT NOT NULL,
    "externalNo" INTEGER,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "residence" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judge_access" (
    "id" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "displayCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "judge_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quran_verses" (
    "id" INTEGER NOT NULL,
    "jozz" INTEGER NOT NULL,
    "hizbNumber" INTEGER NOT NULL,
    "page" TEXT NOT NULL,
    "suraNumber" INTEGER NOT NULL,
    "suraNameAr" TEXT NOT NULL,
    "suraNameEn" TEXT NOT NULL,
    "ayaNumber" INTEGER NOT NULL,
    "lineStart" INTEGER NOT NULL,
    "lineEnd" INTEGER NOT NULL,
    "ayaText" TEXT NOT NULL,

    CONSTRAINT "quran_verses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "drawSeed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "kind" "CriterionKind" NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_rules" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "kind" "PenaltyKind" NOT NULL,
    "labelAr" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "hizbCount" INTEGER NOT NULL,
    "labelAr" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 4,
    "amountUnit" TEXT NOT NULL DEFAULT 'wajh',
    "amountValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_judges" (
    "categoryId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_judges_pkey" PRIMARY KEY ("categoryId","judgeId")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "externalId" INTEGER,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "birthDate" TIMESTAMP(3),
    "teacherName" TEXT,
    "scopeRaw" TEXT NOT NULL,
    "scopeKind" "ScopeKind" NOT NULL,
    "scopeStartVerseId" INTEGER NOT NULL,
    "scopeEndVerseId" INTEGER NOT NULL,
    "scopeReversed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "candidateId" TEXT,
    "source" "QuestionSource" NOT NULL DEFAULT 'AUTO',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startVerseId" INTEGER NOT NULL,
    "endVerseId" INTEGER NOT NULL,
    "amountUnit" TEXT NOT NULL,
    "amountValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judging_sessions" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "status" "JudgingStatus" NOT NULL DEFAULT 'PENDING',
    "hifzBase" DOUBLE PRECISION,
    "pointsPerQuestion" DOUBLE PRECISION,
    "hifzScore" DOUBLE PRECISION,
    "directTotal" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judging_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_results" (
    "id" TEXT NOT NULL,
    "judgingSessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "talathumCount" INTEGER NOT NULL DEFAULT 0,
    "tanbihCount" INTEGER NOT NULL DEFAULT 0,
    "fathCount" INTEGER NOT NULL DEFAULT 0,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criterion_scores" (
    "id" TEXT NOT NULL,
    "judgingSessionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "criterion_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "judges_userId_key" ON "judges"("userId");

-- CreateIndex
CREATE INDEX "judges_fullName_idx" ON "judges"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "judge_access_tokenHash_key" ON "judge_access"("tokenHash");

-- CreateIndex
CREATE INDEX "judge_access_judgeId_idx" ON "judge_access"("judgeId");

-- CreateIndex
CREATE INDEX "judge_access_competitionId_idx" ON "judge_access"("competitionId");

-- CreateIndex
CREATE INDEX "judge_access_expiresAt_idx" ON "judge_access"("expiresAt");

-- CreateIndex
CREATE INDEX "quran_verses_suraNumber_ayaNumber_idx" ON "quran_verses"("suraNumber", "ayaNumber");

-- CreateIndex
CREATE INDEX "quran_verses_page_idx" ON "quran_verses"("page");

-- CreateIndex
CREATE INDEX "quran_verses_hizbNumber_idx" ON "quran_verses"("hizbNumber");

-- CreateIndex
CREATE INDEX "quran_verses_jozz_idx" ON "quran_verses"("jozz");

-- CreateIndex
CREATE UNIQUE INDEX "criteria_competitionId_key_key" ON "criteria"("competitionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_rules_competitionId_kind_key" ON "penalty_rules"("competitionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "categories_competitionId_hizbCount_key" ON "categories"("competitionId", "hizbCount");

-- CreateIndex
CREATE INDEX "candidates_competitionId_categoryId_idx" ON "candidates"("competitionId", "categoryId");

-- CreateIndex
CREATE INDEX "candidates_fullName_idx" ON "candidates"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_competitionId_externalId_key" ON "candidates"("competitionId", "externalId");

-- CreateIndex
CREATE INDEX "questions_competitionId_idx" ON "questions"("competitionId");

-- CreateIndex
CREATE INDEX "questions_candidateId_idx" ON "questions"("candidateId");

-- CreateIndex
CREATE INDEX "questions_categoryId_idx" ON "questions"("categoryId");

-- CreateIndex
CREATE INDEX "judging_sessions_competitionId_status_idx" ON "judging_sessions"("competitionId", "status");

-- CreateIndex
CREATE INDEX "judging_sessions_judgeId_idx" ON "judging_sessions"("judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "judging_sessions_candidateId_judgeId_key" ON "judging_sessions"("candidateId", "judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "question_results_judgingSessionId_questionId_key" ON "question_results"("judgingSessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "criterion_scores_judgingSessionId_criterionId_key" ON "criterion_scores"("judgingSessionId", "criterionId");

-- AddForeignKey
ALTER TABLE "judges" ADD CONSTRAINT "judges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judge_access" ADD CONSTRAINT "judge_access_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judge_access" ADD CONSTRAINT "judge_access_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_judges" ADD CONSTRAINT "category_judges_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_judges" ADD CONSTRAINT "category_judges_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_startVerseId_fkey" FOREIGN KEY ("startVerseId") REFERENCES "quran_verses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judging_sessions" ADD CONSTRAINT "judging_sessions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judging_sessions" ADD CONSTRAINT "judging_sessions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judging_sessions" ADD CONSTRAINT "judging_sessions_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "judges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_judgingSessionId_fkey" FOREIGN KEY ("judgingSessionId") REFERENCES "judging_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criterion_scores" ADD CONSTRAINT "criterion_scores_judgingSessionId_fkey" FOREIGN KEY ("judgingSessionId") REFERENCES "judging_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criterion_scores" ADD CONSTRAINT "criterion_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
