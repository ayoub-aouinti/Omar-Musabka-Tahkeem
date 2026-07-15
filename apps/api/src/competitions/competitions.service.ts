import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CriterionKind } from "@prisma/client";
import {
  DEFAULT_HIFZ_BASE,
  DEFAULT_PENALTY_WEIGHTS,
  type PenaltyWeights,
} from "@tahkeem/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TAJWEED_CRITERIA } from "./tajweed-criteria";
import type {
  CreateCompetitionDto,
  SetCategoryJudgesDto,
  UpdateCompetitionDto,
  UpdateScoringDto,
  UpsertCategoryDto,
} from "./dto";

const DEFAULT_CRITERIA = [
  {
    key: "hifz",
    labelAr: "الحفظ",
    descriptionAr: undefined as string | undefined,
    kind: CriterionKind.PENALTY,
    maxPoints: DEFAULT_HIFZ_BASE,
    sortOrder: 0,
    scales: [] as [],
  },
  // The 2025 tajweed rubric — each criterion with its per-category scales.
  ...TAJWEED_CRITERIA.map((c, i) => ({
    key: c.key,
    labelAr: c.labelAr,
    descriptionAr: c.descriptionAr,
    kind: CriterionKind.DIRECT,
    maxPoints: c.maxPoints,
    sortOrder: i + 1,
    scales: c.scales,
  })),
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
        criteria: {
          orderBy: { sortOrder: "asc" },
          include: {
            scales: {
              orderBy: { sortOrder: "asc" },
              include: { bands: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
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
    const criteria = (dto.criteria ?? DEFAULT_CRITERIA).map((c, i) => ({
      key: c.key,
      labelAr: c.labelAr,
      descriptionAr: "descriptionAr" in c ? c.descriptionAr : undefined,
      kind: c.kind,
      maxPoints: c.maxPoints,
      sortOrder: c.sortOrder ?? i,
      scales: {
        create: ("scales" in c ? (c.scales ?? []) : []).map((s, si) => ({
          labelAr: s.labelAr,
          minHizb: s.minHizb,
          maxHizb: s.maxHizb,
          maxPoints: s.maxPoints,
          sortOrder: si,
          bands: {
            create: (s.bands ?? []).map((b, bi) => ({
              minPoints: b.minPoints,
              maxPoints: b.maxPoints,
              descriptionAr: b.descriptionAr,
              sortOrder: bi,
            })),
          },
        })),
      },
    }));

    return this.prisma.competition.create({
      data: {
        name: dto.name,
        location: dto.location,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        criteria: { create: criteria },
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
      // Deleting the criteria cascades their scales and bands.
      await tx.criterion.deleteMany({ where: { competitionId: id } });
      await tx.penaltyRule.deleteMany({ where: { competitionId: id } });

      // Nested create so each criterion's scales and bands land in one write.
      for (const [i, c] of dto.criteria.entries()) {
        await tx.criterion.create({
          data: {
            competitionId: id,
            key: c.key,
            labelAr: c.labelAr,
            descriptionAr: c.descriptionAr,
            kind: c.kind,
            maxPoints: c.maxPoints,
            sortOrder: c.sortOrder ?? i,
            scales: {
              create: (c.scales ?? []).map((s, si) => ({
                labelAr: s.labelAr,
                minHizb: s.minHizb,
                maxHizb: s.maxHizb,
                maxPoints: s.maxPoints,
                sortOrder: si,
                bands: {
                  create: (s.bands ?? []).map((b, bi) => ({
                    minPoints: b.minPoints,
                    maxPoints: b.maxPoints,
                    descriptionAr: b.descriptionAr,
                    sortOrder: bi,
                  })),
                },
              })),
            },
          },
        });
      }

      await tx.penaltyRule.createMany({
        data: dto.penaltyRules.map((r) => ({ ...r, competitionId: id })),
      });

      return tx.competition.findUnique({
        where: { id },
        include: {
          criteria: {
            orderBy: { sortOrder: "asc" },
            include: {
              scales: {
                orderBy: { sortOrder: "asc" },
                include: { bands: { orderBy: { sortOrder: "asc" } } },
              },
            },
          },
          penaltyRules: true,
        },
      });
    });
  }

  /**
   * The hifz base, penalty weights and general criteria, ready for the scoring
   * engine. When `hizbCount` is given, each general criterion's ceiling and
   * guidance bands are resolved to the scale matching that category — the 2025
   * rubric scores التجويد differently for «دون 30 حزبًا» and «30 فما فوق».
   */
  async getScoringConfig(
    competitionId: string,
    hizbCount?: number,
  ): Promise<{
    hifzBase: number;
    weights: PenaltyWeights;
    directCriteria: Array<{
      id: string;
      key: string;
      labelAr: string;
      maxPoints: number;
      scaleLabelAr: string | null;
      bands: Array<{ minPoints: number; maxPoints: number; descriptionAr: string }>;
    }>;
  }> {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        penaltyRules: true,
        criteria: {
          orderBy: { sortOrder: "asc" },
          include: {
            scales: {
              orderBy: { sortOrder: "asc" },
              include: { bands: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
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
        .map((criterion) => {
          const scale =
            hizbCount == null
              ? null
              : (criterion.scales.find(
                  (s) => hizbCount >= s.minHizb && hizbCount <= s.maxHizb,
                ) ?? null);
          return {
            id: criterion.id,
            key: criterion.key,
            labelAr: criterion.labelAr,
            maxPoints: scale?.maxPoints ?? criterion.maxPoints,
            scaleLabelAr: scale?.labelAr ?? null,
            bands: (scale?.bands ?? []).map((b) => ({
              minPoints: b.minPoints,
              maxPoints: b.maxPoints,
              descriptionAr: b.descriptionAr,
            })),
          };
        }),
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

  private async getCategory(competitionId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, competitionId },
    });
    if (!category) throw new NotFoundException("الصنف غير موجود");
    return category;
  }

  /** The judge panel seated on a category — the default for its candidates. */
  async listCategoryJudges(competitionId: string, categoryId: string) {
    await this.getCategory(competitionId, categoryId);
    const rows = await this.prisma.categoryJudge.findMany({
      where: { categoryId },
      include: { judge: { select: { id: true, fullName: true, gender: true } } },
      orderBy: { assignedAt: "asc" },
    });
    return rows.map((r) => r.judge);
  }

  /** Replace a category's judge panel — assigns a whole group at once. */
  async setCategoryJudges(
    competitionId: string,
    categoryId: string,
    dto: SetCategoryJudgesDto,
  ) {
    await this.getCategory(competitionId, categoryId);

    const unique = [...new Set(dto.judgeIds)];
    if (unique.length) {
      const found = await this.prisma.judge.count({
        where: { id: { in: unique } },
      });
      if (found !== unique.length) {
        throw new BadRequestException("أحد المحكّمين غير موجود");
      }
    }

    await this.prisma.$transaction([
      this.prisma.categoryJudge.deleteMany({ where: { categoryId } }),
      ...(unique.length
        ? [
            this.prisma.categoryJudge.createMany({
              data: unique.map((judgeId) => ({ categoryId, judgeId })),
            }),
          ]
        : []),
    ]);

    return this.listCategoryJudges(competitionId, categoryId);
  }
}
