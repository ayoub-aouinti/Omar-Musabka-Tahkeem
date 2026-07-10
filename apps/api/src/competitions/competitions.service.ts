import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CriterionKind } from "@prisma/client";
import {
  DEFAULT_HIFZ_BASE,
  DEFAULT_PENALTY_WEIGHTS,
  type PenaltyWeights,
} from "@tahkeem/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateCompetitionDto,
  UpdateCompetitionDto,
  UpdateScoringDto,
  UpsertCategoryDto,
} from "./dto";

const DEFAULT_CRITERIA = [
  {
    key: "hifz",
    labelAr: "الحفظ",
    kind: CriterionKind.PENALTY,
    maxPoints: DEFAULT_HIFZ_BASE,
    sortOrder: 0,
  },
  {
    key: "tajweed",
    labelAr: "التجويد",
    kind: CriterionKind.DIRECT,
    maxPoints: 30,
    sortOrder: 1,
  },
  {
    key: "adaa",
    labelAr: "الأداء والصوت",
    kind: CriterionKind.DIRECT,
    maxPoints: 10,
    sortOrder: 2,
  },
];

const DEFAULT_PENALTY_RULES = [
  { kind: "TALATHUM" as const, labelAr: "تلعثم", weight: DEFAULT_PENALTY_WEIGHTS.talathum },
  { kind: "TANBIH" as const, labelAr: "تنبيه", weight: DEFAULT_PENALTY_WEIGHTS.tanbih },
  { kind: "FATH" as const, labelAr: "فتح", weight: DEFAULT_PENALTY_WEIGHTS.fath },
];

@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.competition.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { candidates: true, categories: true } },
      },
    });
  }

  async get(id: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id },
      include: {
        criteria: { orderBy: { sortOrder: "asc" } },
        penaltyRules: true,
        categories: {
          orderBy: { hizbCount: "asc" },
          include: { _count: { select: { candidates: true } } },
        },
        _count: { select: { candidates: true } },
      },
    });
    if (!competition) throw new NotFoundException("المسابقة غير موجودة");
    return competition;
  }

  create(dto: CreateCompetitionDto) {
    return this.prisma.competition.create({
      data: {
        name: dto.name,
        location: dto.location,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        criteria: { create: dto.criteria ?? DEFAULT_CRITERIA },
        penaltyRules: { create: dto.penaltyRules ?? DEFAULT_PENALTY_RULES },
      },
      include: { criteria: true, penaltyRules: true },
    });
  }

  async update(id: string, dto: UpdateCompetitionDto) {
    await this.get(id);
    return this.prisma.competition.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.competition.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Replace the scoring configuration. Refused once results exist: rewriting the
   * weights under a submitted score would silently change a published result.
   */
  async updateScoring(id: string, dto: UpdateScoringDto) {
    await this.get(id);

    const penaltyCount = dto.criteria.filter(
      (c) => c.kind === CriterionKind.PENALTY,
    ).length;
    if (penaltyCount !== 1) {
      throw new BadRequestException(
        "يجب تحديد معيار واحد بالضبط من نوع «الحفظ» (PENALTY)",
      );
    }

    const submitted = await this.prisma.judgingSession.count({
      where: { competitionId: id, status: "SUBMITTED" },
    });
    if (submitted > 0) {
      throw new BadRequestException(
        `لا يمكن تعديل المعايير بعد اعتماد ${submitted} نتيجة`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.criterion.deleteMany({ where: { competitionId: id } });
      await tx.penaltyRule.deleteMany({ where: { competitionId: id } });
      await tx.criterion.createMany({
        data: dto.criteria.map((c) => ({ ...c, competitionId: id })),
      });
      await tx.penaltyRule.createMany({
        data: dto.penaltyRules.map((r) => ({ ...r, competitionId: id })),
      });
      return tx.competition.findUnique({
        where: { id },
        include: { criteria: { orderBy: { sortOrder: "asc" } }, penaltyRules: true },
      });
    });
  }

  /** The hifz base and penalty weights, as the scoring engine wants them. */
  async getScoringConfig(competitionId: string): Promise<{
    hifzBase: number;
    weights: PenaltyWeights;
    directCriteria: Array<{ id: string; key: string; labelAr: string; maxPoints: number }>;
  }> {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      include: { criteria: { orderBy: { sortOrder: "asc" } }, penaltyRules: true },
    });
    if (!competition) throw new NotFoundException("المسابقة غير موجودة");

    const hifz = competition.criteria.find((c) => c.kind === CriterionKind.PENALTY);
    if (!hifz) {
      throw new BadRequestException("لا يوجد معيار حفظ (PENALTY) لهذه المسابقة");
    }

    const weightOf = (kind: string, fallback: number) =>
      competition.penaltyRules.find((r) => r.kind === kind)?.weight ?? fallback;

    return {
      hifzBase: hifz.maxPoints,
      weights: {
        talathum: weightOf("TALATHUM", DEFAULT_PENALTY_WEIGHTS.talathum),
        tanbih: weightOf("TANBIH", DEFAULT_PENALTY_WEIGHTS.tanbih),
        fath: weightOf("FATH", DEFAULT_PENALTY_WEIGHTS.fath),
      },
      directCriteria: competition.criteria
        .filter((c) => c.kind === CriterionKind.DIRECT)
        .map(({ id, key, labelAr, maxPoints }) => ({ id, key, labelAr, maxPoints })),
    };
  }

  // ── categories ──

  listCategories(competitionId: string) {
    return this.prisma.category.findMany({
      where: { competitionId },
      orderBy: { hizbCount: "asc" },
      include: { _count: { select: { candidates: true } } },
    });
  }

  async upsertCategory(competitionId: string, dto: UpsertCategoryDto) {
    await this.get(competitionId);
    return this.prisma.category.upsert({
      where: { competitionId_hizbCount: { competitionId, hizbCount: dto.hizbCount } },
      update: dto,
      create: { ...dto, competitionId },
    });
  }
}
