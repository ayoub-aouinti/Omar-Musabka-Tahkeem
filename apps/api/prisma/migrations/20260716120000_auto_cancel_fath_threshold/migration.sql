-- Configurable rule: once a question's فتح count reaches this threshold, any
-- further error auto-cancels it (ملغى). Null keeps the rule disabled, so
-- existing competitions are unaffected until an admin opts in.
ALTER TABLE "competitions" ADD COLUMN "autoCancelFathThreshold" INTEGER;
