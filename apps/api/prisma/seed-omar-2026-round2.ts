/**
 * One-off seed script for a SECOND, separate competition:
 *
 *   «المسابقة المحليّة في حفظ القرآن الكريم للفرع المحلّي للرابطة الوطنية
 *    للقرآن الكريم عمر بن الخطاب بدار شعبان الفهري - دورة 2026م»
 *
 * Source workbook: `data/musabaqa-2026-round2.xlsx`
 *   · قائمة الطّلبة   → 469 candidates across 15 categories (no gender column —
 *                        gender is inferred, see `guessGender` below)
 *   · اللجان صباحا / اللجان مساء → judge committees, each covering one or more
 *                        categories (parsed into per-category judge panels)
 *
 * The rubric photographed from the branch's paper score sheets splits into
 * FOUR distinct groups, two of which use entirely different criteria names
 * (2/3/4 vs. everything else) — see `resolveDirectCriteria` in
 * `@tahkeem/shared`, which omits a criterion for any category outside all of
 * its scales rather than falling back to a default ceiling.
 *
 * This script does NOT touch `مسابقة عمر بن الخطاب لحفظ القرآن الكريم 2026`
 * (the original seed.ts competition) — different name, so it is safe to
 * re-run without affecting it. It also assumes the Quran verses have already
 * been loaded (run `pnpm prisma:seed` first on a fresh database).
 *
 * Run: `pnpm --filter api seed:omar-2026-round2`
 */
import { join } from "node:path";
import { Gender, PrismaClient, type ScopeKind } from "@prisma/client";
import { buildQuranIndex, tryParseScope, type VerseRow } from "@tahkeem/shared";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

const DATA_DIR = join(__dirname, "data");
const WORKBOOK = join(DATA_DIR, "musabaqa-2026-round2.xlsx");

const SHEET_CANDIDATES = "قائمة الطّلبة";
const SHEET_COMMITTEES_MORNING = "اللجان صباحا";
const SHEET_COMMITTEES_EVENING = "اللجان مساء";

const COMPETITION_NAME =
  "المسابقة المحليّة في حفظ القرآن الكريم للفرع المحلّي للرابطة الوطنية للقرآن الكريم عمر بن الخطاب بدار شعبان الفهري - دورة 2026م";

// ─────────────────────────── helpers ───────────────────────────

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

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

// ─────────────────────────── gender heuristic ───────────────────────────
//
// The roster has no الجنس column. بن/بنت markers (an explicit "son/daughter
// of" in the surname) are unambiguous and checked first; everything else is
// resolved against a curated first-name dictionary. Names flagged `uncertain`
// still get a best-effort guess so the row imports, but are surfaced in the
// end-of-run report for manual correction via the Candidates screen.

const FEMALE_NAMES = new Set([
  "آمنة",
  "آية",
  "أسماء",
  "أميرة",
  "إسراء",
  "إنصاف",
  "إيمان",
  "إيناس",
  "اكرام",
  "الاء",
  "الهام",
  "امال",
  "اية",
  "ايلاف",
  "ايمان",
  "ايناس",
  "بسمة",
  "بشرى",
  "تسنيم",
  "تهاني",
  "جميلة",
  "حفصية",
  "حميدة",
  "حياة",
  "خديجة",
  "خولة",
  "درّة",
  "درة",
  "دعاء",
  "راضية",
  "رانية",
  "ربيعة",
  "رجا",
  "رحاب",
  "رحمة",
  "رفقة",
  "رفيقة",
  "رقية",
  "رنيم",
  "روان",
  "زهرة",
  "زينب",
  "سارة",
  "سامية",
  "سعاد",
  "سعيدة",
  "سكينة",
  "سلمى",
  "سلوى",
  "سمية",
  "سميرة",
  "سنية",
  "سوسن",
  "سيرين",
  "شفاء",
  "شيماء",
  "صباح",
  "صبرين",
  "عائشة",
  "عبير",
  "عفيفة",
  "علية",
  "فاتن",
  "فاطمة",
  "فاطمة الزهراء",
  "فتيحة",
  "فداء",
  "فدوى",
  "فردوس",
  "غفران",
  "كريمة",
  "كنزة",
  "لجين",
  "لطيفة",
  "لمياء",
  "لمية",
  "ليلى",
  "لينا",
  "لينة",
  "ملاك",
  "منال",
  "منى",
  "مريم",
  "ميار",
  "نبيهة",
  "نجاة",
  "نجاح",
  "نجلاء",
  "نجوى",
  "نزيهة",
  "نسيمة",
  "نعيمة",
  "نهال",
  "نهلة",
  "نوال",
  "نور الهدى",
  "نوران",
  "نورة",
  "هاجر",
  "هالة",
  "هبة",
  "هدى",
  "هناء",
  "هنية",
  "وئام",
  "وجدان",
  "ولاء",
  "ياسمين",
  "يسر",
  "يسرى",
  "يمنى",
  "ٱمنة",
]);

const MALE_NAMES = new Set([
  "آدم",
  "أحمد",
  "أيمن",
  "أيوب",
  "إبراهيم",
  "إسكندر",
  "إياد",
  "احمد",
  "اسامة",
  "الحبيب",
  "الصادق",
  "انس",
  "ايوب",
  "بلال",
  "ثابت",
  "تقي الدين",
  "حمزة",
  "خليل",
  "زكرياء",
  "زياد",
  "سليم",
  "سليمان",
  "سيف الدين",
  "عبد الرحمان",
  "عبيد",
  "علاء الدين",
  "عمر",
  "عيسى",
  "فادي",
  "فؤاد",
  "فاضل",
  "فراس",
  "قيس",
  "معتز",
  "مؤمن",
  "مالك",
  "محمد",
  "محمد أمين",
  "محمود",
  "معاذ",
  "مهدي",
  "نافع",
  "نجم الدين",
  "وسام",
  "وسيم",
  "ياسين",
  "يحي",
  "يحيى",
  "يوسف",
  "ٱدم",
]);

/** Best-effort guesses for genuinely ambiguous/rare first names — always flagged. */
const UNCERTAIN_NAMES: Record<string, Gender> = {
  اسلام: Gender.MALE,
  بحار: Gender.MALE,
  جهاد: Gender.MALE,
  جودة: Gender.MALE, // matches "جودة بن حميدة" elsewhere in the same roster
  داودة: Gender.FEMALE,
  سندة: Gender.FEMALE,
  سلسبيل: Gender.FEMALE,
  منيار: Gender.FEMALE,
  يقين: Gender.FEMALE,
  يمن: Gender.FEMALE,
  ريحان: Gender.MALE,
  ريان: Gender.MALE,
  نور: Gender.FEMALE,
};

const COMPOUND_FIRST_NAMES = [
  "نور الهدى",
  "عبد الرحمان",
  "عبد الله",
  "عبد الستار",
  "عبد القادر",
  "عبد الكريم",
  "عبد الحميد",
  "عبد الوهاب",
  "عبد الخالق",
  "عبد المجيد",
  "تقي الدين",
  "علاء الدين",
  "سيف الدين",
  "صلاح الدين",
  "فاطمة الزهراء",
  "محمد أمين",
  "محمد الأمين",
  "نجم الدين",
];

interface GenderGuess {
  gender: Gender;
  confident: boolean;
}

function guessGender(fullName: string): GenderGuess {
  const name = text(fullName);

  if (/(^|\s)بنت(\s|$)/.test(name)) return { gender: Gender.FEMALE, confident: true };
  if (/(^|\s)بن(\s|$)/.test(name) || name.startsWith("ابن ")) {
    return { gender: Gender.MALE, confident: true };
  }

  const firstToken =
    COMPOUND_FIRST_NAMES.find((c) => name.startsWith(c)) ?? name.split(/\s+/)[0];

  if (FEMALE_NAMES.has(firstToken)) return { gender: Gender.FEMALE, confident: true };
  if (MALE_NAMES.has(firstToken)) return { gender: Gender.MALE, confident: true };
  if (firstToken in UNCERTAIN_NAMES) {
    return { gender: UNCERTAIN_NAMES[firstToken], confident: false };
  }

  // Last resort: Arabic feminine endings (ة / اء) lean female, else male —
  // always flagged since it's a pure guess.
  const gender = /(ة|اء)$/.test(firstToken) ? Gender.FEMALE : Gender.MALE;
  return { gender, confident: false };
}

// ─────────────────────────── category bands (the photographed rubric) ───

const CATEGORY_HIZB_COUNTS = [2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

function questionCountFor(hizbCount: number): number {
  if (hizbCount <= 4) return 2;
  if (hizbCount <= 15) return 3;
  return 4;
}

interface ScaleSeed {
  labelAr: string;
  minHizb: number;
  maxHizb: number;
  maxPoints: number;
}

interface CriterionSeed {
  key: string;
  labelAr: string;
  maxPoints: number;
  scales: ScaleSeed[];
}

const YOUNG = { labelAr: "الأصناف 2-4", minHizb: 2, maxHizb: 4 } as const;
const MID = { labelAr: "الأصناف 5-25", minHizb: 5, maxHizb: 25 } as const;
const SENIOR = { labelAr: "الأصناف 30 فما فوق", minHizb: 30, maxHizb: 60 } as const;

const DIRECT_CRITERIA: CriterionSeed[] = [
  // صنف 2/3/4 — its own rubric, never shown outside hizb 2-4.
  { key: "fann", labelAr: "الفن", maxPoints: 10, scales: [{ ...YOUNG, maxPoints: 10 }] },
  { key: "mad_tabiie", labelAr: "المد الطبيعي", maxPoints: 5, scales: [{ ...YOUNG, maxPoints: 5 }] },
  { key: "mudood_ukhra", labelAr: "المدود الأخرى", maxPoints: 8, scales: [{ ...YOUNG, maxPoints: 8 }] },
  { key: "qalqala", labelAr: "القلقلة", maxPoints: 8, scales: [{ ...YOUNG, maxPoints: 8 }] },
  { key: "tahakkum_tanaffus", labelAr: "التحكم في التنفس", maxPoints: 4, scales: [{ ...YOUNG, maxPoints: 4 }] },
  // صنف 5..60 — shared rubric, ceiling drops for 30 فما فوق.
  { key: "ghunna", labelAr: "غنن", maxPoints: 10, scales: [{ ...MID, maxPoints: 10 }, { ...SENIOR, maxPoints: 8 }] },
  { key: "mudood", labelAr: "مدود", maxPoints: 10, scales: [{ ...MID, maxPoints: 10 }, { ...SENIOR, maxPoints: 8 }] },
  { key: "makharij_sifat", labelAr: "المخارج والصفات", maxPoints: 16, scales: [{ ...MID, maxPoints: 10 }, { ...SENIOR, maxPoints: 16 }] },
  { key: "waqf_ibtidaa", labelAr: "الوقف والابتداء", maxPoints: 5, scales: [{ ...MID, maxPoints: 5 }, { ...SENIOR, maxPoints: 3 }] },
  // حسن الأداء — every category.
  { key: "husn_adaa", labelAr: "حسن الأداء", maxPoints: 5, scales: [{ labelAr: "جميع الأصناف", minHizb: 2, maxHizb: 60, maxPoints: 5 }] },
];

// ─────────────────────────── committee → category parsing ───────────────

/**
 * "45-60" (one dash) → an inclusive numeric range, matched against the 15
 * known category hizbCounts. "40-50-55" (two+ dashes) is NOT a contiguous
 * range — it's a discrete list, since 41-49/51-54 aren't real categories.
 * "30" (no dash) → that single category.
 */
function parseCategoryRange(raw: string): number[] {
  const parts = text(raw).split("-").map((p) => Number(p.trim())).filter((n) => !Number.isNaN(n));
  if (parts.length <= 1) return parts;
  if (parts.length === 2) {
    const [min, max] = parts;
    return CATEGORY_HIZB_COUNTS.filter((h) => h >= min && h <= max);
  }
  return parts.filter((h) => CATEGORY_HIZB_COUNTS.includes(h));
}

interface CommitteeRow {
  categoryRaw: string;
  judgeNames: string[];
}

function readCommittees(workbook: XLSX.WorkBook, sheetName: string): CommitteeRow[] {
  const [, ...rows] = readSheet(workbook, sheetName);
  const out: CommitteeRow[] = [];
  for (const row of rows) {
    const [, categoryRaw, , judge2, judge1] = row;
    if (!text(categoryRaw)) continue;
    const judgeNames = [judge1, judge2].map(text).filter(Boolean);
    out.push({ categoryRaw: text(categoryRaw), judgeNames });
  }
  return out;
}

// ─────────────────────────── main ───────────────────────────

async function main() {
  console.log(`\nSeeding: ${COMPETITION_NAME}\n`);

  const verseCount = await prisma.quranVerse.count();
  if (verseCount === 0) {
    throw new Error(
      "No Quran verses loaded — run `pnpm prisma:seed` first (this script only " +
        "creates the new competition, not the shared Quran reference data).",
    );
  }
  const verses = (await prisma.quranVerse.findMany()) as unknown as VerseRow[];
  const index = buildQuranIndex(verses);

  const workbook = XLSX.readFile(WORKBOOK, { cellDates: true });

  // ── judges, from both committee sheets ──
  const morningCommittees = readCommittees(workbook, SHEET_COMMITTEES_MORNING);
  const eveningCommittees = readCommittees(workbook, SHEET_COMMITTEES_EVENING);
  const allCommittees = [...morningCommittees, ...eveningCommittees];

  const judgeNames = [...new Set(allCommittees.flatMap((c) => c.judgeNames))].sort();
  const flaggedJudgeGenders: Array<{ name: string; guessed: Gender }> = [];

  const judgeIdByName = new Map<string, string>();
  for (const name of judgeNames) {
    const guess = guessGender(name);
    if (!guess.confident) flaggedJudgeGenders.push({ name, guessed: guess.gender });

    const existing = await prisma.judge.findFirst({ where: { fullName: name } });
    const judge = existing
      ? await prisma.judge.update({ where: { id: existing.id }, data: { gender: guess.gender } })
      : await prisma.judge.create({ data: { fullName: name, gender: guess.gender } });
    judgeIdByName.set(name, judge.id);
  }
  console.log(`  ✔ Judges: ${judgeNames.length}`);

  // ── competition, criteria, categories ──
  await prisma.competition.deleteMany({ where: { name: COMPETITION_NAME } });

  const competition = await prisma.competition.create({
    data: {
      name: COMPETITION_NAME,
      location: "دار شعبان الفهري",
      status: "DRAFT",
      startDate: new Date(Date.UTC(2026, 6, 19)),
      drawSeed: 20260719,
      criteria: {
        create: [
          {
            key: "hifz",
            labelAr: "الحفظ",
            descriptionAr:
              "يُحتسب آليًا: ٦٠ ناقص مجموع الخصومات (ملغى، فتح، تنبيه، تلعثم).",
            kind: "PENALTY",
            maxPoints: 60,
            sortOrder: 0,
          },
          ...DIRECT_CRITERIA.map((criterion, i) => ({
            key: criterion.key,
            labelAr: criterion.labelAr,
            kind: "DIRECT" as const,
            maxPoints: criterion.maxPoints,
            sortOrder: i + 1,
            scales: {
              create: criterion.scales.map((scale, si) => ({
                labelAr: scale.labelAr,
                minHizb: scale.minHizb,
                maxHizb: scale.maxHizb,
                maxPoints: scale.maxPoints,
                sortOrder: si,
              })),
            },
          })),
        ],
      },
      penaltyRules: {
        create: [
          { kind: "TALATHUM", labelAr: "تلعثم", weight: 0.25 },
          { kind: "TANBIH", labelAr: "تنبيه", weight: 0.75 },
          { kind: "FATH", labelAr: "فتح", weight: 1.5 },
        ],
      },
    },
  });
  console.log(`  ✔ Competition: ${competition.name} (${competition.id})`);

  const categoryByHizb = new Map<number, string>();
  for (const hizbCount of CATEGORY_HIZB_COUNTS) {
    const category = await prisma.category.create({
      data: {
        competitionId: competition.id,
        hizbCount,
        labelAr: hizbLabel(hizbCount),
        questionCount: questionCountFor(hizbCount),
        amountUnit: "wajh",
        amountValue: 1,
      },
    });
    categoryByHizb.set(hizbCount, category.id);
  }
  console.log(`  ✔ Categories: ${CATEGORY_HIZB_COUNTS.join(", ")}`);

  // ── candidates ──
  const [, ...candidateRows] = readSheet(workbook, SHEET_CANDIDATES);
  const rows = candidateRows.filter((row) => text(row[5]) !== ""); // fullName column

  const scopeFailures: Array<{ row: number; name: string; error: string }> = [];
  const flaggedCandidateGenders: Array<{ name: string; guessed: Gender }> = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const [, , scopeRaw, hizbRaw, teacher, fullName, externalId] = row;

    const hizbCount = Number(hizbRaw);
    const categoryId = categoryByHizb.get(hizbCount);
    if (!categoryId) {
      scopeFailures.push({ row: i + 2, name: text(fullName), error: `unknown category "${text(hizbRaw)}"` });
      continue;
    }

    const parsed = tryParseScope(text(scopeRaw), index);
    if (!parsed.ok) {
      scopeFailures.push({ row: i + 2, name: text(fullName), error: parsed.error });
      continue;
    }

    const guess = guessGender(text(fullName));
    if (!guess.confident) flaggedCandidateGenders.push({ name: text(fullName), guessed: guess.gender });

    await prisma.candidate.create({
      data: {
        competitionId: competition.id,
        categoryId,
        externalId: Number(externalId) || null,
        fullName: text(fullName),
        gender: guess.gender,
        teacherName: text(teacher) || null,
        scopeRaw: parsed.scope.raw,
        scopeKind: parsed.scope.kind as ScopeKind,
        scopeStartVerseId: parsed.scope.startVerseId,
        scopeEndVerseId: parsed.scope.endVerseId,
        scopeReversed: parsed.scope.reversed,
      },
    });
    imported++;
  }
  console.log(`  ✔ Candidates: ${imported} / ${rows.length}`);

  // ── category ↔ judge panels ──
  const panels = new Map<number, Set<string>>();
  for (const committee of allCommittees) {
    const hizbCounts = parseCategoryRange(committee.categoryRaw);
    for (const hizb of hizbCounts) {
      if (!panels.has(hizb)) panels.set(hizb, new Set());
      for (const name of committee.judgeNames) panels.get(hizb)!.add(name);
    }
  }

  let panelSeats = 0;
  for (const [hizb, names] of panels) {
    const categoryId = categoryByHizb.get(hizb);
    if (!categoryId) continue;
    const judgeIds = [...names].map((n) => judgeIdByName.get(n)).filter((id): id is string => !!id);
    await prisma.categoryJudge.createMany({
      data: judgeIds.map((judgeId) => ({ categoryId, judgeId })),
      skipDuplicates: true,
    });
    panelSeats += judgeIds.length;
  }
  console.log(`  ✔ Category judge panels: ${panelSeats} seats across ${panels.size} categories`);

  // ── report ──
  if (scopeFailures.length) {
    console.warn(`\n  ⚠ ${scopeFailures.length} candidate rows could not be imported:`);
    for (const f of scopeFailures) console.warn(`      row ${f.row} — ${f.name}: ${f.error}`);
  }

  const flaggedGenders = [
    ...flaggedCandidateGenders.map((f) => ({ ...f, kind: "candidate" as const })),
    ...flaggedJudgeGenders.map((f) => ({ ...f, kind: "judge" as const })),
  ];
  if (flaggedGenders.length) {
    console.warn(
      `\n  ⚠ ${flaggedGenders.length} names had no reliable gender marker — best-effort guess used, please review:`,
    );
    for (const f of flaggedGenders) {
      console.warn(`      [${f.kind}] ${f.name} → guessed ${f.guessed}`);
    }
  }

  console.log("\nDone.\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
