import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthUser } from "../common/auth.types";
import { CurrentUser, Roles } from "../common/decorators";
import { SubmitScoresDto } from "./dto";
import { JudgingService } from "./judging.service";

@ApiTags("judging")
@Controller("judging")
export class JudgingController {
  constructor(private readonly judging: JudgingService) {}

  @Get("my-candidates")
  @ApiOperation({ summary: "المتسابقون المسندون إلى المحكّم الحالي" })
  async myCandidates(
    @CurrentUser() user: AuthUser,
    @Query("competitionId") competitionIdQuery?: string,
  ) {
    const judgeId = requireJudge(user);
    // A QR-issued token is already bound to one competition; a password login is
    // not, so let the service infer it when there is only one possibility.
    const competitionId = await this.judging.resolveCompetitionId(
      judgeId,
      user.competitionId ?? competitionIdQuery,
    );
    return this.judging.myCandidates(judgeId, competitionId);
  }

  @Post("sessions/:candidateId/open")
  @ApiOperation({ summary: "فتح جلسة تحكيم (تولّد الأسئلة عند الاقتضاء)" })
  open(@CurrentUser() user: AuthUser, @Param("candidateId") candidateId: string) {
    return this.judging.openSession(requireJudge(user), candidateId);
  }

  @Post("submit")
  @ApiOperation({ summary: "حفظ مسودة أو اعتماد النتيجة" })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitScoresDto) {
    return this.judging.submit(requireJudge(user), dto);
  }

  @Post("preview")
  @ApiOperation({ summary: "حساب الدرجة دون حفظ" })
  preview(
    @Query("competitionId") competitionId: string,
    @Query("questionCount", ParseIntPipe) questionCount: number,
    @Body() dto: SubmitScoresDto,
  ) {
    return this.judging.preview(competitionId, questionCount, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get("results")
  @ApiOperation({ summary: "الترتيب حسب معدّل درجات المحكّمين" })
  results(
    @Query("competitionId") competitionId: string,
    @Query("categoryId") categoryId?: string,
  ) {
    return this.judging.results(competitionId, categoryId);
  }
}

function requireJudge(user: AuthUser): string {
  if (!user.judgeId) {
    throw new BadRequestException("هذا الحساب غير مرتبط بمحكّم");
  }
  return user.judgeId;
}
