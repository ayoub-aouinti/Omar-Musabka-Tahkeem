import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ScopeParseError } from "@tahkeem/shared";
import { QuranService } from "./quran.service";

@ApiTags("quran")
@Controller("quran")
export class QuranController {
  constructor(private readonly quran: QuranService) {}

  @Get("surahs")
  @ApiOperation({ summary: "قائمة السور مع حدود آياتها" })
  surahs() {
    return this.quran.listSurahs();
  }

  @Get("pages/:page")
  @ApiOperation({ summary: "آيات صفحة من المصحف" })
  page(@Param("page") page: string) {
    return this.quran.getPage(page);
  }

  @Get("verses")
  @ApiOperation({ summary: "آيات نطاق (من آية إلى آية)" })
  verses(
    @Query("start", ParseIntPipe) start: number,
    @Query("end", ParseIntPipe) end: number,
  ) {
    if (end - start > 500) {
      throw new BadRequestException("النطاق كبير جدًا (الحد 500 آية)");
    }
    return this.quran.getRange(start, end);
  }

  /** Lets the dashboard preview how a scope string will be understood. */
  @Get("scope")
  @ApiOperation({ summary: "تحليل نص النطاق مثل «من مريم إلى النّاس»" })
  scope(@Query("raw") raw: string) {
    try {
      const parsed = this.quran.parseScope(raw ?? "");
      const start = this.quran.getVerse(parsed.startVerseId);
      const end = this.quran.getVerse(parsed.endVerseId);
      return {
        ...parsed,
        verseCount: parsed.endVerseId - parsed.startVerseId + 1,
        start: { surah: start.suraNameAr, ayah: start.ayaNumber, page: start.page },
        end: { surah: end.suraNameAr, ayah: end.ayaNumber, page: end.page },
      };
    } catch (error) {
      if (error instanceof ScopeParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
