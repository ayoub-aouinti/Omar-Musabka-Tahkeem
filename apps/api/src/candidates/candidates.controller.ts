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
import { CreateCandidateDto, ListCandidatesDto, UpdateCandidateDto } from "./dto";

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
}
