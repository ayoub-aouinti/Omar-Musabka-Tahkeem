-- Adds the typed `رمز التحقّق` alongside the QR token on a judge's credential.
--
-- `codeHash` is NOT NULL UNIQUE and cannot be back-filled: the plaintext code is
-- never stored, so an existing row has no code to hash. These rows are
-- short-lived access cards (hours), not records worth preserving, so they are
-- cleared. Any judge holding an un-redeemed card is simply issued a new one.
DELETE FROM "judge_access";

ALTER TABLE "judge_access" ADD COLUMN "codeHash" TEXT NOT NULL;

CREATE UNIQUE INDEX "judge_access_codeHash_key" ON "judge_access"("codeHash");
