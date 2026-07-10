import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators";
import { CreateManualQuestionDto, GenerateDto } from "./dto";
import { QuestionsService } from "./questions.service";

@ApiTags("questions")
@Controller("questions")
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get("bank")
  @ApiOperation({ summary: "بنك الأسئلة (غير مسندة لمتسابق)" })
  bank(
    @Query("competitionId") competitionId: string,
    @Query("categoryId") categoryId?: string,
  ) {
    return this.questions.listBank(competitionId, categoryId);
  }

  @Get("candidate/:candidateId")
  forCandidate(@Param("candidateId") candidateId: string) {
    return this.questions.listForCandidate(candidateId);
  }

  @Get(":id/passage")
  @ApiOperation({ summary: "آيات السؤال، لعرضها في تطبيق المحكّم" })
  passage(@Param("id") id: string) {
    return this.questions.getPassage(id);
  }

  @Roles(UserRole.ADMIN)
  @Post("candidate/:candidateId/generate")
  @ApiOperation({ summary: "توليد أسئلة متسابق داخل نطاق حفظه (قابل للتكرار)" })
  generate(@Param("candidateId") candidateId: string, @Body() dto: GenerateDto) {
    return this.questions.generateForCandidate(candidateId, dto.regenerate);
  }

  @Roles(UserRole.ADMIN)
  @Post("category/:categoryId/generate")
  @ApiOperation({ summary: "توليد أسئلة صنف كامل" })
  generateCategory(
    @Param("categoryId") categoryId: string,
    @Body() dto: GenerateDto,
  ) {
    return this.questions.generateForCategory(categoryId, dto.regenerate);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: "إضافة سؤال يدويًا" })
  createManual(@Body() dto: CreateManualQuestionDto) {
    return this.questions.createManual(dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.questions.remove(id);
  }
}
