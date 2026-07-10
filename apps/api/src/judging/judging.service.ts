import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JudgingStatus } from "@prisma/client";
import {
  computeCompetitionScore,
  type DirectCriterionScore,
  emptyTally,
  type QuestionTally,
} from "@tahkeem/shared";
import { CompetitionsService } from "../competitions/competitions.service";
import { PrismaService } from "../prisma/prisma.service";
import { QuestionsService } from "../questions/questions.service";
import type { SubmitScoresDto } from "./dto";

@Injectable()
export class JudgingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly competitions: CompetitionsService,
    private readonly questions: QuestionsService,
  ) {}

  /**
   * The competition a judge is working on. A QR token names it; a password
   * login does not, so fall back to the single competition they are seated on.
   * Only ambiguity is an error.
   */
  async resolveCompetitionId(
    judgeId: string,
    requested?: string,
  ): Promise<string> {
    if (requested) return requested;

    const seats = await this.prisma.categoryJudge.findMany({
      where: { judgeId },
      select: { category: { select: { competitionId: true } } },
    });
    const competitionIds = [
      ...new Set(seats.map((seat) => seat.category.competitionId)),
    ];

    if (competitionIds.length === 1) return competitionIds[0];
    if (competitionIds.length === 0) {
      throw new ForbiddenException("لست معيّنًا للتحكيم في أي مسابقة");
    }
    throw new BadRequestException(
      "أنت معيّن في أكثر من مسابقة، حدّد المسابقة (competitionId)",
    );
  }

  /** Candidates this judge may evaluate: those in the categories they sit on. */
  async myCandidates(judgeId: string, competitionId: string) {
    const seats = await this.prisma.categoryJudge.findMany({
      where: { judgeId, category: { competitionId } },
      select: { categoryId: true },
    });
    if (!seats.length) return [];

    return this.prisma.candidate.findMany({
      where: {
        competitionId,
        categoryId: { in: seats.map((s) => s.categoryId) },
      },
      orderBy: { externalId: "asc" },
      include: {
        category: { select: { id: true, labelAr: true, hizbCount: true, questionCount: true } },
        judgingSessions: {
          where: { judgeId },
          select: { id: true, status: true, totalScore: true },
        },
      },
    });
  }

  /**
   * Open (or resume) a judge's session on a candidate, drawing the paper if the
   * admin has not already done so.
   */
  async openSession(judgeId: string, candidateId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { category: true },
    });
    if (!candidate) throw new NotFoundException("المتسابق غير موجود");

    await this.assertSeated(judgeId, candidate.categoryId);

    let questions = await this.questions.listForCandidate(candidateId);
    if (!questions.length) {
      questions = await this.questions.generateForCandidate(candidateId);
    }

    const session = await this.prisma.judgingSession.upsert({
      where: { candidateId_judgeId: { candidateId, judgeId } },
      update: {},
      create: {
        candidateId,
        judgeId,
        competitionId: candidate.competitionId,
        status: JudgingStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: { questionResults: true, criterionScores: true },
    });

    if (session.status === JudgingStatus.PENDING) {
      await this.prisma.judgingSession.update({
        where: { id: session.id },
        data: { status: JudgingStatus.IN_PROGRESS, startedAt: new Date() },
      });
    }

    const scoring = await this.competitions.getScoringConfig(candidate.competitionId);

    const passages = await Promise.all(
      questions.map((q) => this.questions.getPassage(q.id)),
    );

    return {
      session,
      candidate,
      questions: passages,
      scoring: {
        ...scoring,
        questionCount: candidate.category.questionCount,
        pointsPerQuestion: scoring.hifzBase / candidate.category.questionCount,
      },
    };
  }

  /**
   * Record a judge's tallies. `finalize` distinguishes a saved draft from a
   * submitted result; a submitted session is immutable.
   */
  async submit(judgeId: string, dto: SubmitScoresDto) {
    const session = await this.prisma.judgingSession.findUnique({
      where: { id: dto.sessionId },
      include: { candidate: { include: { category: true } } },
    });
    if (!session) throw new NotFoundException("جلسة التحكيم غير موجودة");
    if (session.judgeId !== judgeId) {
      throw new ForbiddenException("هذه الجلسة تخصّ محكّمًا آخر");
    }
    if (session.status === JudgingStatus.SUBMITTED) {
      throw new BadRequestException("تم اعتماد هذه النتيجة ولا يمكن تعديلها");
    }

    const scoring = await this.competitions.getScoringConfig(session.competitionId);
    const questionCount = session.candidate.category.questionCount;

    const paper = await this.questions.listForCandidate(session.candidateId);
    const paperIds = new Set(paper.map((q) => q.id));

    for (const q of dto.questions) {
      if (!paperIds.has(q.questionId)) {
        throw new BadRequestException("سؤال لا ينتمي إلى ورقة هذا المتسابق");
      }
    }

    // Merge this submit over what is already stored, so the score always reflects
    // the whole paper — a per-question save must not wipe the other questions.
    const stored = await this.prisma.questionResult.findMany({
      where: { judgingSessionId: session.id },
    });
    const storedById = new Map(stored.map((r) => [r.questionId, r]));

    // Which questions the judge has locked in («اعتماد تقييم السؤال»). This
    // submit may confirm or unconfirm some; the rest keep their stored state.
    const confirmedIds = new Set(
      stored.filter((r) => r.confirmed).map((r) => r.questionId),
    );
    for (const q of dto.questions) {
      if (q.confirmed === true) confirmedIds.add(q.questionId);
      else if (q.confirmed === false) confirmedIds.delete(q.questionId);
    }

    if (dto.finalize) {
      const unconfirmed = [...paperIds].filter((id) => !confirmedIds.has(id));
      if (unconfirmed.length > 0) {
        throw new BadRequestException(
          `يجب تأكيد كل الأسئلة (${paperIds.size}) قبل اعتماد النتيجة`,
        );
      }
    }

    // Score from the merged view: this submit, else the stored row, else flawless.
    const tallies: QuestionTally[] = paper.map((question) => {
      const submitted = dto.questions.find((q) => q.questionId === question.id);
      if (submitted) {
        return {
          talathum: submitted.talathumCount,
          tanbih: submitted.tanbihCount,
          fath: submitted.fathCount,
          cancelled: submitted.cancelled,
        };
      }
      const row = storedById.get(question.id);
      return row
        ? {
            talathum: row.talathumCount,
            tanbih: row.tanbihCount,
            fath: row.fathCount,
            cancelled: row.cancelled,
          }
        : emptyTally();
    });

    for (const s of dto.criterionScores) {
      if (!scoring.directCriteria.some((c) => c.id === s.criterionId)) {
        throw new BadRequestException(`معيار غير معروف: ${s.criterionId}`);
      }
    }

    // The general criteria (تجويد, صوت) are set once, after the last question.
    // Merge this submit over stored values so finalising sees the full set.
    const storedCriteria = await this.prisma.criterionScore.findMany({
      where: { judgingSessionId: session.id },
    });
    const criteriaValues = new Map(
      storedCriteria.map((c) => [c.criterionId, c.value]),
    );
    for (const s of dto.criterionScores) criteriaValues.set(s.criterionId, s.value);

    const directScores: DirectCriterionScore[] = scoring.directCriteria
      .filter((c) => criteriaValues.has(c.id))
      .map((c) => ({
        criterionId: c.id,
        labelAr: c.labelAr,
        maxPoints: c.maxPoints,
        value: criteriaValues.get(c.id) as number,
      }));

    if (dto.finalize && directScores.length !== scoring.directCriteria.length) {
      throw new BadRequestException("يجب إسناد درجة لكل المعايير العامّة");
    }

    let score: ReturnType<typeof computeCompetitionScore>;
    try {
      score = computeCompetitionScore({
        hifz: {
          baseScore: scoring.hifzBase,
          questionCount,
          weights: scoring.weights,
          tallies,
        },
        directScores,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const q of dto.questions) {
        // Finalising confirms the whole paper; otherwise honour the flag, and
        // keep a question's stored confirmation when the flag is omitted.
        const confirmed = dto.finalize
          ? true
          : (q.confirmed ??
            storedById.get(q.questionId)?.confirmed ??
            false);
        await tx.questionResult.upsert({
          where: {
            judgingSessionId_questionId: {
              judgingSessionId: session.id,
              questionId: q.questionId,
            },
          },
          update: {
            talathumCount: q.talathumCount,
            tanbihCount: q.tanbihCount,
            fathCount: q.fathCount,
            cancelled: q.cancelled,
            confirmed,
          },
          create: {
            judgingSessionId: session.id,
            questionId: q.questionId,
            talathumCount: q.talathumCount,
            tanbihCount: q.tanbihCount,
            fathCount: q.fathCount,
            cancelled: q.cancelled,
            confirmed,
          },
        });
      }

      // Persist only the general criteria this submit carried.
      for (const s of dto.criterionScores) {
        await tx.criterionScore.upsert({
          where: {
            judgingSessionId_criterionId: {
              judgingSessionId: session.id,
              criterionId: s.criterionId,
            },
          },
          update: { value: s.value },
          create: {
            judgingSessionId: session.id,
            criterionId: s.criterionId,
            value: s.value,
          },
        });
      }

      await tx.judgingSession.update({
        where: { id: session.id },
        data: {
          notes: dto.notes,
          status: dto.finalize ? JudgingStatus.SUBMITTED : JudgingStatus.DRAFT_SAVED,
          submittedAt: dto.finalize ? new Date() : null,
          // Snapshot the config that produced this score.
          hifzBase: scoring.hifzBase,
          pointsPerQuestion: score.hifz.pointsPerQuestion,
          hifzScore: score.hifz.score,
          directTotal: score.directTotal,
          totalScore: score.total,
        },
      });
    });

    return { sessionId: session.id, finalized: dto.finalize, score };
  }

  /** Live preview of the score as the judge taps, without persisting anything. */
  async preview(competitionId: string, questionCount: number, dto: SubmitScoresDto) {
    const scoring = await this.competitions.getScoringConfig(competitionId);

    return computeCompetitionScore({
      hifz: {
        baseScore: scoring.hifzBase,
        questionCount,
        weights: scoring.weights,
        tallies: dto.questions.map((q) => ({
          talathum: q.talathumCount,
          tanbih: q.tanbihCount,
          fath: q.fathCount,
          cancelled: q.cancelled,
        })),
      },
      directScores: dto.criterionScores.map((s) => {
        const criterion = scoring.directCriteria.find((c) => c.id === s.criterionId);
        if (!criterion) throw new BadRequestException("معيار غير معروف");
        return { ...criterion, criterionId: criterion.id, value: s.value };
      }),
    });
  }

  /** Ranking for a category, averaged across the judges who submitted. */
  async results(competitionId: string, categoryId?: string) {
    const sessions = await this.prisma.judgingSession.findMany({
      where: {
        competitionId,
        status: JudgingStatus.SUBMITTED,
        ...(categoryId ? { candidate: { categoryId } } : {}),
      },
      include: {
        candidate: { select: { id: true, fullName: true, categoryId: true } },
        judge: { select: { id: true, fullName: true } },
      },
    });

    const byCandidate = new Map<
      string,
      { candidate: (typeof sessions)[number]["candidate"]; scores: number[] }
    >();

    for (const session of sessions) {
      const entry = byCandidate.get(session.candidateId) ?? {
        candidate: session.candidate,
        scores: [],
      };
      if (session.totalScore !== null) entry.scores.push(session.totalScore);
      byCandidate.set(session.candidateId, entry);
    }

    return [...byCandidate.values()]
      .map(({ candidate, scores }) => ({
        candidate,
        judgeCount: scores.length,
        averageScore:
          scores.length === 0
            ? 0
            : Math.round(
                (scores.reduce((a, b) => a + b, 0) / scores.length) * 100,
              ) / 100,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
  }

  private async assertSeated(judgeId: string, categoryId: string) {
    const seat = await this.prisma.categoryJudge.findUnique({
      where: { categoryId_judgeId: { categoryId, judgeId } },
    });
    if (!seat) {
      throw new ForbiddenException("لست معيّنًا للتحكيم في هذا الصنف");
    }
  }
}
