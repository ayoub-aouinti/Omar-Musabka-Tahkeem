-- Distinguishes «اعتماد تقييم السؤال» from «حفظ كمسودّة» on a per-question basis.
-- Existing draft rows default to unconfirmed, matching their intent.
ALTER TABLE "question_results" ADD COLUMN "confirmed" BOOLEAN NOT NULL DEFAULT false;
