import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type Gender, type Prisma, type ScopeKind } from "@prisma/client";
import { ScopeParseError } from "@tahkeem/shared";
import { PrismaService } from "../prisma/prisma.service";
import { QuranService } from "../quran/quran.service";

export interface ListCandidatesQuery {
  competitionId?: string;
  categoryId?: string;
  gender?: Gender;
  search?: string;
  take?: number;
  skip?: number;
}

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quran: QuranService,
  ) {}

  async list(query: ListCandidatesQuery) {
    const take = Math.min(query.take ?? 50, 200);

    const where: Prisma.CandidateWhereInput = {
      competitionId: query.competitionId,
      categoryId: query.categoryId,
      gender: query.gender,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { teacherName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        take,
        skip: query.skip ?? 0,
        orderBy: { externalId: "asc" },
        include: {
          category: { select: { id: true, labelAr: true, hizbCount: true } },
          judgingSessions: { select: { id: true, status: true, judgeId: true } },
        },
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { items, total, take, skip: query.skip ?? 0 };
  }

  async get(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        category: true,
        competition: { select: { id: true, name: true } },
        questions: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!candidate) throw new NotFoundException("المتسابق غير موجود");

    const start = this.quran.getVerse(candidate.scopeStartVerseId);
    const end = this.quran.getVerse(candidate.scopeEndVerseId);

    return {
      ...candidate,
      scope: {
        raw: candidate.scopeRaw,
        kind: candidate.scopeKind,
        reversed: candidate.scopeReversed,
        verseCount: candidate.scopeEndVerseId - candidate.scopeStartVerseId + 1,
        start: { surah: start.suraNameAr, ayah: start.ayaNumber, page: start.page },
        end: { surah: end.suraNameAr, ayah: end.ayaNumber, page: end.page },
      },
    };
  }

  async create(input: {
    competitionId: string;
    categoryId: string;
    externalId?: number;
    fullName: string;
    gender: Gender;
    birthDate?: string;
    teacherName?: string;
    scopeRaw: string;
  }) {
    const scope = this.parseScopeOrThrow(input.scopeRaw);

    return this.prisma.candidate.create({
      data: {
        competitionId: input.competitionId,
        categoryId: input.categoryId,
        externalId: input.externalId ?? null,
        fullName: input.fullName,
        gender: input.gender,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        teacherName: input.teacherName ?? null,
        scopeRaw: scope.raw,
        scopeKind: scope.kind as ScopeKind,
        scopeStartVerseId: scope.startVerseId,
        scopeEndVerseId: scope.endVerseId,
        scopeReversed: scope.reversed,
      },
    });
  }

  async update(
    id: string,
    input: Partial<{
      fullName: string;
      gender: Gender;
      birthDate: string;
      teacherName: string;
      categoryId: string;
      scopeRaw: string;
    }>,
  ) {
    await this.get(id);

    // Re-parsing the scope invalidates any questions already drawn inside it.
    const scope = input.scopeRaw ? this.parseScopeOrThrow(input.scopeRaw) : null;
    if (scope) {
      await this.prisma.question.deleteMany({ where: { candidateId: id } });
    }

    return this.prisma.candidate.update({
      where: { id },
      data: {
        fullName: input.fullName,
        gender: input.gender,
        teacherName: input.teacherName,
        categoryId: input.categoryId,
        birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
        ...(scope
          ? {
              scopeRaw: scope.raw,
              scopeKind: scope.kind as ScopeKind,
              scopeStartVerseId: scope.startVerseId,
              scopeEndVerseId: scope.endVerseId,
              scopeReversed: scope.reversed,
            }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.candidate.delete({ where: { id } });
    return { deleted: true };
  }

  private parseScopeOrThrow(raw: string) {
    try {
      return this.quran.parseScope(raw);
    } catch (error) {
      if (error instanceof ScopeParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
