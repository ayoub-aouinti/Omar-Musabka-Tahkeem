/**
 * One-off, NON-destructive rename: «الطلاقة» → «القلقلة» for the round-2
 * competition only. Updates the single criterion row in place; scores,
 * candidates, and judge assignments are untouched (CriterionScore points at
 * the criterion by id, which does not change).
 *
 * Run against the target database:
 *   DATABASE_URL="<prod url>" pnpm --filter @tahkeem/api exec ts-node -P tsconfig.seed.json prisma/rename-talaqa-qalqala.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COMPETITION_NAME =
  "المسابقة المحليّة في حفظ القرآن الكريم للفرع المحلّي للرابطة الوطنية للقرآن الكريم عمر بن الخطاب بدار شعبان الفهري - دورة 2026م";

async function main() {
  const competition = await prisma.competition.findFirst({
    where: { name: COMPETITION_NAME },
    select: { id: true },
  });
  if (!competition) {
    throw new Error(`Competition not found: ${COMPETITION_NAME}`);
  }

  const result = await prisma.criterion.updateMany({
    where: { competitionId: competition.id, key: "talaqa" },
    data: { key: "qalqala", labelAr: "القلقلة" },
  });

  console.log(`✔ Renamed criteria updated: ${result.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
