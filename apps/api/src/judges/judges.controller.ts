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
import { CreateJudgeDto, IssueAccessDto, UpdateJudgeDto } from "./dto";
import { JudgesService } from "./judges.service";

@ApiTags("judges")
@Roles(UserRole.ADMIN)
@Controller("judges")
export class JudgesController {
  constructor(private readonly judges: JudgesService) {}

  @Get()
  list(@Query("search") search?: string) {
    return this.judges.list(search);
  }

  @Get("access")
  @ApiOperation({ summary: "الجلسات المؤقتة لمسابقة" })
  listAccess(@Query("competitionId") competitionId: string) {
    return this.judges.listAccess(competitionId);
  }

  @Get("stats")
  stats(@Query("competitionId") competitionId: string) {
    return this.judges.stats(competitionId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.judges.get(id);
  }

  @Post()
  create(@Body() dto: CreateJudgeDto) {
    return this.judges.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateJudgeDto) {
    return this.judges.update(id, dto);
  }

  @Post(":id/access")
  @ApiOperation({
    summary: "توليد حساب مؤقت + رمز QR (يُلغي رموز المحكّم السابقة)",
  })
  issueAccess(@Param("id") id: string, @Body() dto: IssueAccessDto) {
    return this.judges.issueAccess(id, dto.competitionId, dto.hours);
  }

  @Delete("access/:accessId")
  @ApiOperation({ summary: "إلغاء رمز QR" })
  revokeAccess(@Param("accessId") accessId: string) {
    return this.judges.revokeAccess(accessId);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.judges.remove(id);
  }
}
