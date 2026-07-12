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
import {
  CreateManualQuestionDto,
  GenerateDto,
  ListBankDto,
  UpdateQuestionDto,
} from "./dto";
import { QuestionsService } from "./questions.service";

@ApiTags("questions")
@Controller("questions")
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get("bank")
  @ApiOperation({ summary: "بنك الأسئلة: كل الأسئلة مع التصفية والصعوبة" })
  bank(@Query() query: ListBankDto) {
    return this.questions.listAll(query);
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
  @ApiOperation({ summary: "إضافة سؤال يدويًا مع درجة الصعوبة" })
  createManual(@Body() dto: CreateManualQuestionDto) {
    return this.questions.createManual(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id")
  @ApiOperation({ summary: "تعديل سؤال (البداية، المقدار، الصعوبة)" })
  update(@Param("id") id: string, @Body() dto: UpdateQuestionDto) {
    return this.questions.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.questions.remove(id);
  }
}
