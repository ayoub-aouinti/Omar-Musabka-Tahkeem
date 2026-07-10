import {
  BadRequestException,
  Controller,
  Param,
  ParseBoolPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators";
import { ImportsService } from "./imports.service";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

@ApiTags("imports")
@Roles(UserRole.ADMIN)
@Controller("imports")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post("competitions/:id/workbook")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  @ApiOperation({
    summary: "رفع ملف إكسيل المسابقة (المتسابقون + المحكّمون). dryRun للمعاينة.",
  })
  upload(
    @Param("id") competitionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query("dryRun", new ParseBoolPipe({ optional: true })) dryRun = false,
  ) {
    if (!file) throw new BadRequestException("لم يتم إرفاق أي ملف");
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException("صيغة غير مدعومة (XLSX أو CSV فقط)");
    }
    return this.imports.importWorkbook(competitionId, file.buffer, dryRun);
  }
}
