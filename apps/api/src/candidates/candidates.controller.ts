import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators";
import { CandidatesService } from "./candidates.service";
import {
  AssignJudgeDto,
  CreateCandidateDto,
  ListCandidatesDto,
  SetJudgesDto,
  UpdateCandidateDto,
} from "./dto";

@ApiTags("candidates")
@Controller("candidates")
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get()
  @ApiOperation({ summary: "قائمة المتسابقين مع البحث والتصفية" })
  list(@Query() query: ListCandidatesDto) {
    return this.candidates.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "بطاقة متسابق مع نطاق حفظه محلولًا" })
  get(@Param("id") id: string) {
    return this.candidates.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCandidateDto) {
    return this.candidates.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCandidateDto) {
    return this.candidates.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.candidates.remove(id);
  }

  @Get(":id/judges")
  @ApiOperation({ summary: "المحكّمون المُسنَدون مباشرةً إلى المتسابق" })
  judges(@Param("id") id: string) {
    return this.candidates.listJudges(id);
  }

  @Roles(UserRole.ADMIN)
  @Post(":id/judges")
  @ApiOperation({ summary: "تعيين محكّمي المتسابق (قائمة فارغة تُعيده لصنفه)" })
  setJudges(@Param("id") id: string, @Body() dto: SetJudgesDto) {
    return this.candidates.setJudges(id, dto.judgeIds);
  }

  @Roles(UserRole.ADMIN)
  @Post("assign-judge")
  @ApiOperation({
    summary: "إسناد محكّم أو أكثر إلى مجموعة من المتسابقين دفعةً واحدة",
  })
  assignJudge(@Body() dto: AssignJudgeDto) {
    return this.candidates.assignJudgeToCandidates(dto.judgeIds, dto.candidateIds);
  }
}
