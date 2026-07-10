import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { QuestionSource } from "@prisma/client";
import { type AmountUnit, createRng, DrawError, drawQuestionStarts } from "@tahkeem/shared";
import { PrismaService } from "../prisma/prisma.service";
import { QuranService } from "../quran/quran.service";

/**
 * Rough verse count of one passage unit, used only to reserve room at the end of
 * a scope when choosing start verses. The exact end is resolved afterwards.
 */
const APPROX_VERSES_PER_UNIT: Record<AmountUnit, number> = {
  ayat: 1,
  wajh: 8,
  page: 8,
  thumn_hizb: 7,
  rub_hizb: 14,
};

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quran: QuranService,
  ) {}

  listForCandidate(candidateId: string) {
    return this.prisma.question.findMany({
      where: { candidateId },
      orderBy: { sortOrder: "asc" },
    });
  }

  /** The shared bank: questions attached to a category rather than a candidate. */
  listBank(competitionId: string, categoryId?: string) {
    return this.prisma.question.findMany({
      where: { competitionId, candidateId: null, categoryId },
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Resolve a question's verses so the mobile app can render the passage. */
  async getPassage(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException("السؤال غير موجود");

    const verses = this.quran.getRange(question.startVerseId, question.endVerseId);
    const first = verses[0];
    const last = verses[verses.length - 1];

    return {
      question,
      verses,
      label: `${first.suraNameAr.trim()} ${first.ayaNumber} — ${last.suraNameAr.trim()} ${last.ayaNumber}`,
      pages: [...new Set(verses.map((v) => v.page))],
    };
  }

  /**
   * Draw a candidate's paper inside their memorisation scope.
   *
   * Deterministic: the same competition seed and candidate always yield the same
   * questions, so a paper can be reprinted. Replaces any existing AUTO questions
   * for that candidate; refuses once the candidate has been judged.
   */
  async generateForCandidate(candidateId: string, regenerate = false) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { category: true, competition: true },
    });
    if (!candidate) throw new NotFoundException("المتسابق غير موجود");

    const submitted = await this.prisma.judgingSession.count({
      where: { candidateId, status: "SUBMITTED" },
    });
    if (submitted > 0) {
      throw new BadRequestException(
        "لا يمكن إعادة توليد الأسئلة بعد اعتماد نتيجة المتسابق",
      );
    }

    const existing = await this.prisma.question.count({ where: { candidateId } });
    if (existing > 0 && !regenerate) {
      return this.listForCandidate(candidateId);
    }
    await this.prisma.question.deleteMany({ where: { candidateId } });

    const { category, competition } = candidate;
    const unit = category.amountUnit as AmountUnit;
    const passageVerses = APPROX_VERSES_PER_UNIT[unit] * category.amountValue;

    // Seed on competition + candidate so each candidate gets a distinct but
    // reproducible paper.
    const rng = createRng(competition.drawSeed + hashString(candidate.id));

    let starts: number[];
    try {
      starts = drawQuestionStarts({
        startVerseId: candidate.scopeStartVerseId,
        endVerseId: candidate.scopeEndVerseId,
        count: category.questionCount,
        passageVerses,
        rng,
      });
    } catch (error) {
      if (error instanceof DrawError) {
        throw new BadRequestException(
          `تعذّر توليد الأسئلة لـ«${candidate.fullName}»: ${error.message}`,
        );
      }
      throw error;
    }

    await this.prisma.question.createMany({
      data: starts.map((startVerseId, i) => ({
        competitionId: competition.id,
        categoryId: category.id,
        candidateId,
        source: QuestionSource.AUTO,
        sortOrder: i,
        startVerseId,
        endVerseId: this.quran.resolvePassageEnd(
          startVerseId,
          unit,
          category.amountValue,
          candidate.scopeEndVerseId,
        ),
        amountUnit: unit,
        amountValue: category.amountValue,
      })),
    });

    return this.listForCandidate(candidateId);
  }

  /** Draw papers for a whole category in one pass; reports per-candidate errors. */
  async generateForCategory(categoryId: string, regenerate = false) {
    const candidates = await this.prisma.candidate.findMany({
      where: { categoryId },
      select: { id: true, fullName: true },
    });

    const generated: string[] = [];
    const failed: Array<{ candidate: string; reason: string }> = [];

    for (const candidate of candidates) {
      try {
        await this.generateForCandidate(candidate.id, regenerate);
        generated.push(candidate.id);
      } catch (error) {
        failed.push({
          candidate: candidate.fullName,
          reason: (error as Error).message,
        });
      }
    }

    return { generated: generated.length, failed };
  }

  /** Hand-entered question: pick a start verse and a passage size. */
  async createManual(input: {
    competitionId: string;
    categoryId?: string;
    candidateId?: string;
    startVerseId: number;
    amountUnit: AmountUnit;
    amountValue: number;
  }) {
    this.quran.getVerse(input.startVerseId); // 400s if the verse does not exist

    let ceiling: number | undefined;
    if (input.candidateId) {
      const candidate = await this.prisma.candidate.findUnique({
        where: { id: input.candidateId },
      });
      if (!candidate) throw new NotFoundException("المتسابق غير موجود");

      if (
        input.startVerseId < candidate.scopeStartVerseId ||
        input.startVerseId > candidate.scopeEndVerseId
      ) {
        throw new BadRequestException(
          "الآية خارج نطاق حفظ المتسابق المصرّح به",
        );
      }
      ceiling = candidate.scopeEndVerseId;
    }

    const sortOrder = await this.prisma.question.count({
      where: { competitionId: input.competitionId, candidateId: input.candidateId ?? null },
    });

    return this.prisma.question.create({
      data: {
        ...input,
        source: QuestionSource.MANUAL,
        sortOrder,
        endVerseId: this.quran.resolvePassageEnd(
          input.startVerseId,
          input.amountUnit,
          input.amountValue,
          ceiling,
        ),
      },
    });
  }

  async remove(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException("السؤال غير موجود");
    await this.prisma.question.delete({ where: { id } });
    return { deleted: true };
  }
}

/** Stable 32-bit hash, so a candidate's draw does not depend on insertion order. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
