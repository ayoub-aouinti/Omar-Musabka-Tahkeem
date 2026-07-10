import { BadRequestException, Injectable } from "@nestjs/common";
import { type Gender, type ScopeKind } from "@prisma/client";
import { parseGender, tryParseScope } from "@tahkeem/shared";
import * as XLSX from "xlsx";
import { PrismaService } from "../prisma/prisma.service";
import { QuranService } from "../quran/quran.service";

const SHEET_CANDIDATES = "قائمة الطلبة";
const SHEET_JUDGES = "قائمة المحكّمين";

export interface RowError {
  row: number;
  name: string;
  reason: string;
}

export interface ImportReport {
  dryRun: boolean;
  candidates: { imported: number; skipped: number };
  judges: { imported: number };
  categoriesCreated: number[];
  errors: RowError[];
}

const text = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

function parseBirthDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const raw = text(value);
  if (!raw) return null;

  // Excel's locale writes these as M/D/YYYY.
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, month, day, year] = slash;
    return new Date(Date.UTC(+year, +month - 1, +day));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quran: QuranService,
  ) {}

  /**
   * Import the branch's workbook into a competition.
   *
   * `dryRun` validates every row and reports what would happen without writing,
   * so the dashboard can show the admin a preview before committing.
   */
  async importWorkbook(
    competitionId: string,
    buffer: Buffer,
    dryRun: boolean,
  ): Promise<ImportReport> {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
    });
    if (!competition) throw new BadRequestException("المسابقة غير موجودة");

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    } catch {
      throw new BadRequestException("تعذّر قراءة ملف الإكسيل");
    }

    const errors: RowError[] = [];
    const report: ImportReport = {
      dryRun,
      candidates: { imported: 0, skipped: 0 },
      judges: { imported: 0 },
      categoriesCreated: [],
      errors,
    };

    const judgeRows = this.sheet(workbook, SHEET_JUDGES, errors);
    const candidateRows = this.sheet(workbook, SHEET_CANDIDATES, errors);

    if (judgeRows) {
      report.judges.imported = await this.importJudges(judgeRows, dryRun, errors);
    }
    if (candidateRows) {
      await this.importCandidates(competitionId, candidateRows, dryRun, report);
    }

    return report;
  }

  private sheet(
    workbook: XLSX.WorkBook,
    name: string,
    errors: RowError[],
  ): unknown[][] | null {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      errors.push({ row: 0, name, reason: `الورقة «${name}» غير موجودة` });
      return null;
    }
    const [, ...rows] = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: null,
    });
    return rows;
  }

  private async importJudges(
    rows: unknown[][],
    dryRun: boolean,
    errors: RowError[],
  ): Promise<number> {
    let imported = 0;

    for (const [i, row] of rows.entries()) {
      const [residence, gender, fullName, externalNo] = row;
      const name = text(fullName);
      if (!name) continue;

      let parsedGender: Gender;
      try {
        parsedGender = parseGender(text(gender)) as Gender;
      } catch (error) {
        errors.push({ row: i + 2, name, reason: (error as Error).message });
        continue;
      }

      imported++;
      if (dryRun) continue;

      const existing = await this.prisma.judge.findFirst({
        where: { fullName: name },
      });
      const data = {
        fullName: name,
        gender: parsedGender,
        residence: text(residence) || null,
        externalNo: Number(externalNo) || null,
      };

      if (existing) {
        await this.prisma.judge.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.judge.create({ data });
      }
    }

    return imported;
  }

  private async importCandidates(
    competitionId: string,
    rows: unknown[][],
    dryRun: boolean,
    report: ImportReport,
  ): Promise<void> {
    const index = this.quran.getIndex();
    const dataRows = rows.filter((row) => text(row[0]) !== "");

    // Categories are derived from the distinct الصّنف values in the sheet.
    const hizbCounts = [
      ...new Set(dataRows.map((row) => Number(row[5])).filter(Boolean)),
    ].sort((a, b) => a - b);

    const existing = await this.prisma.category.findMany({
      where: { competitionId },
    });
    const categoryByHizb = new Map(existing.map((c) => [c.hizbCount, c.id]));

    for (const hizbCount of hizbCounts) {
      if (categoryByHizb.has(hizbCount)) continue;
      report.categoriesCreated.push(hizbCount);
      if (dryRun) continue;

      const category = await this.prisma.category.create({
        data: {
          competitionId,
          hizbCount,
          labelAr: hizbCount === 60 ? "60 حزبًا (القرآن كاملًا)" : `${hizbCount} أحزاب`,
          questionCount: 4,
          amountUnit: "wajh",
          amountValue: 1,
        },
      });
      categoryByHizb.set(hizbCount, category.id);
    }

    for (const [i, row] of dataRows.entries()) {
      const [externalId, fullName, gender, birthDate, teacher, hizb, scopeRaw] = row;
      const name = text(fullName);
      const rowNumber = i + 2;

      const scope = tryParseScope(text(scopeRaw), index);
      if (!scope.ok) {
        report.candidates.skipped++;
        report.errors.push({ row: rowNumber, name, reason: scope.error });
        continue;
      }

      const categoryId = categoryByHizb.get(Number(hizb));
      if (!categoryId && !dryRun) {
        report.candidates.skipped++;
        report.errors.push({
          row: rowNumber,
          name,
          reason: `صنف غير معروف: «${text(hizb)}»`,
        });
        continue;
      }

      let parsedGender: Gender;
      try {
        parsedGender = parseGender(text(gender)) as Gender;
      } catch (error) {
        report.candidates.skipped++;
        report.errors.push({ row: rowNumber, name, reason: (error as Error).message });
        continue;
      }

      report.candidates.imported++;
      if (dryRun) continue;

      const data = {
        competitionId,
        categoryId: categoryId!,
        externalId: Number(externalId) || null,
        fullName: name,
        gender: parsedGender,
        birthDate: parseBirthDate(birthDate),
        teacherName: text(teacher) || null,
        scopeRaw: scope.scope.raw,
        scopeKind: scope.scope.kind as ScopeKind,
        scopeStartVerseId: scope.scope.startVerseId,
        scopeEndVerseId: scope.scope.endVerseId,
        scopeReversed: scope.scope.reversed,
      };

      // Re-importing a corrected workbook updates rows rather than duplicating.
      const externalIdNum = Number(externalId) || null;
      if (externalIdNum !== null) {
        await this.prisma.candidate.upsert({
          where: {
            competitionId_externalId: { competitionId, externalId: externalIdNum },
          },
          update: data,
          create: data,
        });
      } else {
        await this.prisma.candidate.create({ data });
      }
    }
  }
}
