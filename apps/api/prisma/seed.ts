/**
 * Seeds the database from the two source-of-truth artefacts:
 *
 *  1. `data/quran-qaloun-v2-1.json` — the Qaloun mushaf (6214 verses).
 *  2. `data/musabaqa-2026.xlsx`     — the branch's competition workbook:
 *       · قائمة الطلبة    → 405 candidates + their categories
 *       · قائمة المحكّمين → 28 judges
 *       · المعايير        → the penalty weights of the hifz formula
 *
 * Re-runnable: everything is upserted, and the 2026 competition is rebuilt from
 * scratch each time so a corrected workbook can simply be re-seeded.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Gender,
  PenaltyKind,
  PrismaClient,
  type ScopeKind,
  UserRole,
} from "@prisma/client";
import {
  buildQuranIndex,
  DEFAULT_HIFZ_BASE,
  DEFAULT_PENALTY_WEIGHTS,
  parseGender,
  tryParseScope,
  type VerseRow,
} from "@tahkeem/shared";
import * as bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

const DATA_DIR = join(__dirname, "data");
const QURAN_JSON = join(DATA_DIR, "quran-qaloun-v2-1.json");
const WORKBOOK = join(DATA_DIR, "musabaqa-2026.xlsx");

const SHEET_CANDIDATES = "قائمة الطلبة";
const SHEET_JUDGES = "قائمة المحكّمين";

const COMPETITION_NAME = "مسابقة عمر بن الخطاب لحفظ القرآن الكريم 2026";

// ─────────────────────────── helpers ───────────────────────────

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

/**
 * The workbook mixes real Excel dates with strings like "1/16/2007". Excel's
 * locale writes those as M/D/YYYY.
 */
function parseBirthDate(value: unknown): Date | null {
  if (value instanceof Date) return value;

  const raw = text(value);
  if (!raw) return null;

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, month, day, year] = slash;
    return new Date(Date.UTC(+year, +month - 1, +day));
  }

  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function readSheet(workbook: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    throw new Error(
      `Sheet "${name}" not found. Available: ${workbook.SheetNames.join(", ")}`,
    );
  }
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
}

const hizbLabel = (hizbCount: number): string =>
  hizbCount === 60 ? "60 حزبًا (القرآن كاملًا)" : `${hizbCount} أحزاب`;

// ─────────────────────────── Quran ───────────────────────────

async function seedQuran(): Promise<VerseRow[]> {
  const verses = JSON.parse(readFileSync(QURAN_JSON, "utf8")) as Array<
    VerseRow & {
      jozz: number;
      hizbNumber: number;
      page: string;
      suraNameEn: string;
      lineStart: number;
      lineEnd: number;
      ayaText: string;
    }
  >;

  const existing = await prisma.quranVerse.count();
  if (existing === verses.length) {
    console.log(`  ✔ Quran already loaded (${existing} verses)`);
    return verses;
  }

  await prisma.quranVerse.deleteMany();

  // 6214 rows in chunks — a single createMany exceeds the parameter limit.
  const CHUNK = 1000;
  for (let i = 0; i < verses.length; i += CHUNK) {
    await prisma.quranVerse.createMany({
      data: verses.slice(i, i + CHUNK).map((v) => ({
        id: v.id,
        jozz: v.jozz,
        hizbNumber: v.hizbNumber,
        page: String(v.page),
        suraNumber: v.suraNumber,
        suraNameAr: v.suraNameAr.trim(),
        suraNameEn: v.suraNameEn.trim(),
        ayaNumber: v.ayaNumber,
        lineStart: v.lineStart,
        lineEnd: v.lineEnd,
        ayaText: v.ayaText,
      })),
    });
  }

  console.log(`  ✔ Quran loaded (${verses.length} verses, 114 surahs)`);
  return verses;
}

// ─────────────────────────── admin ───────────────────────────

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@omar-quran.tn";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@2026";

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN },
    create: {
      email,
      name: "مدير المسابقة",
      role: UserRole.ADMIN,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  console.log(`  ✔ Admin ready: ${admin.email}`);
}

// ─────────────────────────── judges ───────────────────────────

async function seedJudges(workbook: XLSX.WorkBook) {
  const [, ...rows] = readSheet(workbook, SHEET_JUDGES);

  let count = 0;
  for (const row of rows) {
    const [residence, gender, fullName, externalNo] = row;
    if (!text(fullName)) continue;

    const name = text(fullName);
    const existing = await prisma.judge.findFirst({ where: { fullName: name } });

    const data = {
      fullName: name,
      gender: parseGender(text(gender)) as Gender,
      residence: text(residence) || null,
      externalNo: Number(externalNo) || null,
    };

    if (existing) {
      await prisma.judge.update({ where: { id: existing.id }, data });
    } else {
      await prisma.judge.create({ data });
    }
    count++;
  }

  console.log(`  ✔ Judges: ${count}`);
}

// ─────────────────────────── competition ───────────────────────────

async function seedCompetition(workbook: XLSX.WorkBook, verses: VerseRow[]) {
  // Rebuild from scratch so a corrected workbook re-seeds cleanly.
  await prisma.competition.deleteMany({ where: { name: COMPETITION_NAME } });

  const competition = await prisma.competition.create({
    data: {
      name: COMPETITION_NAME,
      location: "دار شعبان الفهري",
      status: "ACTIVE",
      drawSeed: 20260101,
      criteria: {
        create: [
          {
            key: "hifz",
            labelAr: "الحفظ",
            descriptionAr:
              "يُحتسب آليًا: ٦٠ ناقص مجموع الخصومات (ملغى، فتح، تنبيه، تلعثم).",
            kind: "PENALTY",
            maxPoints: DEFAULT_HIFZ_BASE,
            sortOrder: 0,
          },
          {
            key: "tajweed",
            labelAr: "التجويد",
            descriptionAr: "أحكام النون والميم ومخارج الحروف.",
            kind: "DIRECT",
            maxPoints: 30,
            sortOrder: 1,
          },
          {
            key: "adaa",
            labelAr: "الأداء والصوت",
            descriptionAr: "التدفق الجمالي وحسن الصوت.",
            kind: "DIRECT",
            maxPoints: 10,
            sortOrder: 2,
          },
        ],
      },
      penaltyRules: {
        create: [
          {
            kind: PenaltyKind.TALATHUM,
            labelAr: "تلعثم",
            weight: DEFAULT_PENALTY_WEIGHTS.talathum,
          },
          {
            kind: PenaltyKind.TANBIH,
            labelAr: "تنبيه",
            weight: DEFAULT_PENALTY_WEIGHTS.tanbih,
          },
          {
            kind: PenaltyKind.FATH,
            labelAr: "فتح",
            weight: DEFAULT_PENALTY_WEIGHTS.fath,
          },
        ],
      },
    },
  });

  console.log(`  ✔ Competition: ${competition.name}`);

  // ── categories, from the distinct الصّنف المشارك به values ──
  const [, ...rows] = readSheet(workbook, SHEET_CANDIDATES);
  const candidateRows = rows.filter((row) => text(row[0]) !== "");

  const hizbCounts = [
    ...new Set(candidateRows.map((row) => Number(row[5])).filter(Boolean)),
  ].sort((a, b) => a - b);

  const categoryByHizb = new Map<number, string>();
  for (const hizbCount of hizbCounts) {
    const category = await prisma.category.create({
      data: {
        competitionId: competition.id,
        hizbCount,
        labelAr: hizbLabel(hizbCount),
        questionCount: 4,
        amountUnit: "wajh",
        amountValue: 1,
      },
    });
    categoryByHizb.set(hizbCount, category.id);
  }
  console.log(`  ✔ Categories: ${hizbCounts.join(", ")}`);

  // ── candidates, with their scope parsed into a verse range ──
  const index = buildQuranIndex(verses);
  const failures: Array<{ row: number; name: string; error: string }> = [];
  const payload: Array<Parameters<typeof prisma.candidate.create>[0]["data"]> =
    [];

  candidateRows.forEach((row, i) => {
    const [externalId, fullName, gender, birthDate, teacher, hizb, scopeRaw] =
      row;

    const parsed = tryParseScope(text(scopeRaw), index);
    if (!parsed.ok) {
      failures.push({ row: i + 2, name: text(fullName), error: parsed.error });
      return;
    }

    const categoryId = categoryByHizb.get(Number(hizb));
    if (!categoryId) {
      failures.push({
        row: i + 2,
        name: text(fullName),
        error: `unknown category "${text(hizb)}"`,
      });
      return;
    }

    payload.push({
      competitionId: competition.id,
      categoryId,
      externalId: Number(externalId) || null,
      fullName: text(fullName),
      gender: parseGender(text(gender)) as Gender,
      birthDate: parseBirthDate(birthDate),
      teacherName: text(teacher) || null,
      scopeRaw: parsed.scope.raw,
      scopeKind: parsed.scope.kind as ScopeKind,
      scopeStartVerseId: parsed.scope.startVerseId,
      scopeEndVerseId: parsed.scope.endVerseId,
      scopeReversed: parsed.scope.reversed,
    });
  });

  for (const data of payload) {
    await prisma.candidate.create({ data });
  }

  const reversed = payload.filter((c) => c.scopeReversed).length;
  console.log(
    `  ✔ Candidates: ${payload.length} (${reversed} declared their range end-first)`,
  );

  if (failures.length) {
    console.warn(`  ⚠ ${failures.length} candidate rows could not be imported:`);
    for (const f of failures) {
      console.warn(`      row ${f.row} — ${f.name}: ${f.error}`);
    }
  }

  // ── seat every judge on every category ──
  // A broad default the admin narrows from the dashboard. Assignment is by
  // category, and categories are not gendered, so the branch's separation of
  // male and female panels is enforced when seats are edited, not here.
  const judges = await prisma.judge.findMany();
  const categories = await prisma.category.findMany({
    where: { competitionId: competition.id },
  });

  await prisma.categoryJudge.createMany({
    data: categories.flatMap((category) =>
      judges.map((judge) => ({ categoryId: category.id, judgeId: judge.id })),
    ),
    skipDuplicates: true,
  });
  console.log(`  ✔ Panel seated: ${judges.length} judges × ${categories.length} categories`);
}

// ─────────────────────────── main ───────────────────────────

async function main() {
  console.log("\nSeeding منصة التحكيم القرآني…\n");

  const workbook = XLSX.readFile(WORKBOOK, { cellDates: true });

  const verses = await seedQuran();
  await seedAdmin();
  await seedJudges(workbook);
  await seedCompetition(workbook, verses);

  console.log("\nDone.\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
