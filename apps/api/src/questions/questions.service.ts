import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type QuestionDifficulty, QuestionSource } from "@prisma/client";
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

  /**
   * بنك الأسئلة — every question in a competition (auto-drawn per candidate and
   * hand-entered bank alike), with the owning candidate/category and the start
   * verse resolved for display. Filterable by category, candidate and difficulty.
   */
  async listAll(query: {
    competitionId: string;
    categoryId?: string;
    candidateId?: string;
    difficulty?: QuestionDifficulty;
    source?: QuestionSource;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(query.take ?? 100, 500);
    const where = {
      competitionId: query.competitionId,
      categoryId: query.categoryId,
      candidateId: query.candidateId,
      difficulty: query.difficulty,
      source: query.source,
    };

    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        take,
        skip: query.skip ?? 0,
        orderBy: [{ candidateId: "asc" }, { sortOrder: "asc" }],
        include: {
          candidate: { select: { id: true, fullName: true, externalId: true } },
          category: { select: { id: true, labelAr: true, hizbCount: true } },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    const items = rows.map((q) => {
      const start = this.quran.getVerse(q.startVerseId);
      const end = this.quran.getVerse(q.endVerseId);
      return {
        ...q,
        startRef: { surah: start.suraNameAr.trim(), ayah: start.ayaNumber, page: start.page },
        endRef: { surah: end.suraNameAr.trim(), ayah: end.ayaNumber, page: end.page },
        verseCount: q.endVerseId - q.startVerseId + 1,
      };
    });

    return { items, total, take, skip: query.skip ?? 0 };
  }

  /** Edit a bank question: its start, size or difficulty. Recomputes the end. */
  async update(
    id: string,
    input: {
      startVerseId?: number;
      amountUnit?: AmountUnit;
      amountValue?: number;
      difficulty?: QuestionDifficulty;
    },
  ) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { candidate: true },
    });
    if (!question) throw new NotFoundException("السؤال غير موجود");

    const submitted = question.candidateId
      ? await this.prisma.judgingSession.count({
          where: { candidateId: question.candidateId, status: "SUBMITTED" },
        })
      : 0;
    if (submitted > 0) {
      throw new BadRequestException("لا يمكن تعديل سؤال متسابق بعد اعتماد نتيجته");
    }

    const startVerseId = input.startVerseId ?? question.startVerseId;
    const amountUnit = (input.amountUnit ?? question.amountUnit) as AmountUnit;
    const amountValue = input.amountValue ?? question.amountValue;

    if (input.startVerseId !== undefined) this.quran.getVerse(startVerseId); // 400s if absent

    // Keep a candidate question inside their declared scope.
    const ceiling = question.candidate?.scopeEndVerseId;
    if (
      question.candidate &&
      (startVerseId < question.candidate.scopeStartVerseId ||
        startVerseId > question.candidate.scopeEndVerseId)
    ) {
      throw new BadRequestException("الآية خارج نطاق حفظ المتسابق");
    }

    return this.prisma.question.update({
      where: { id },
      data: {
        startVerseId,
        amountUnit,
        amountValue,
        difficulty: input.difficulty,
        endVerseId: this.quran.resolvePassageEnd(
          startVerseId,
          amountUnit,
          amountValue,
          ceiling,
        ),
      },
    });
  }

  /**
   * Resolve a question for the mobile app: the full mushaf page(s) it sits on,
   * with the passage highlighted, plus the passage's own verses (used for the
   * short label). The judge reads the page as printed, not a bare excerpt.
   */
  async getPassage(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException("السؤال غير موجود");

    const passageVerses = this.quran.getRange(
      question.startVerseId,
      question.endVerseId,
    );
    const first = passageVerses[0];
    const last = passageVerses[passageVerses.length - 1];
    const page = this.quran.getQuestionPage(
      question.startVerseId,
      question.endVerseId,
    );

    return {
      question,
      // Full page(s) with per-verse highlight + surah-start flags.
      page,
      // The passage span only — kept for callers that still want it.
      verses: passageVerses,
      label: `${first.suraNameAr.trim()} ${first.ayaNumber} — ${last.suraNameAr.trim()} ${last.ayaNumber}`,
      pages: page.pages,
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
    difficulty?: QuestionDifficulty;
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
