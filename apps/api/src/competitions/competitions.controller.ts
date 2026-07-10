import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators";
import { CompetitionsService } from "./competitions.service";
import {
  CreateCompetitionDto,
  UpdateCompetitionDto,
  UpdateScoringDto,
  UpsertCategoryDto,
} from "./dto";

@ApiTags("competitions")
@Controller("competitions")
export class CompetitionsController {
  constructor(private readonly competitions: CompetitionsService) {}

  @Get()
  @ApiOperation({ summary: "قائمة المسابقات" })
  list() {
    return this.competitions.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.competitions.get(id);
  }

  @Get(":id/scoring")
  @ApiOperation({ summary: "إعدادات التقييم (الأساس والخصومات)" })
  scoring(@Param("id") id: string) {
    return this.competitions.getScoringConfig(id);
  }

  @Get(":id/categories")
  categories(@Param("id") id: string) {
    return this.competitions.listCategories(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCompetitionDto) {
    return this.competitions.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompetitionDto) {
    return this.competitions.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Put(":id/scoring")
  @ApiOperation({ summary: "تعديل المعايير — مرفوض بعد اعتماد أي نتيجة" })
  updateScoring(@Param("id") id: string, @Body() dto: UpdateScoringDto) {
    return this.competitions.updateScoring(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Put(":id/categories")
  upsertCategory(@Param("id") id: string, @Body() dto: UpsertCategoryDto) {
    return this.competitions.upsertCategory(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.competitions.remove(id);
  }
}
