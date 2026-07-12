-- 1) Tajweed criteria that score differently per category (الأصناف), per the
--    branch's 2025 rules: a criterion carries scales, each scale descriptive bands.
CREATE TABLE "criterion_scales" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "minHizb" INTEGER NOT NULL,
    "maxHizb" INTEGER NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "criterion_scales_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "criterion_scales_criterionId_idx" ON "criterion_scales"("criterionId");
ALTER TABLE "criterion_scales" ADD CONSTRAINT "criterion_scales_criterionId_fkey"
    FOREIGN KEY ("criterionId") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "criterion_bands" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "minPoints" DOUBLE PRECISION NOT NULL,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "criterion_bands_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "criterion_bands_scaleId_idx" ON "criterion_bands"("scaleId");
ALTER TABLE "criterion_bands" ADD CONSTRAINT "criterion_bands_scaleId_fkey"
    FOREIGN KEY ("scaleId") REFERENCES "criterion_scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) A judge may be assigned a group of candidates; a candidate may have several
--    judges. A direct assignment overrides the category seat.
CREATE TABLE "candidate_judges" (
    "candidateId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "candidate_judges_pkey" PRIMARY KEY ("candidateId","judgeId")
);
CREATE INDEX "candidate_judges_judgeId_idx" ON "candidate_judges"("judgeId");
ALTER TABLE "candidate_judges" ADD CONSTRAINT "candidate_judges_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_judges" ADD CONSTRAINT "candidate_judges_judgeId_fkey"
    FOREIGN KEY ("judgeId") REFERENCES "judges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) درجة الصعوبة on a question, editable from بنك الأسئلة.
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
ALTER TABLE "questions" ADD COLUMN "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "questions" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
