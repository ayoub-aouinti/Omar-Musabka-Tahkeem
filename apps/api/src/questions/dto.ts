import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

const AMOUNT_UNITS = ["ayat", "wajh", "page", "thumn_hizb", "rub_hizb"] as const;

export class GenerateDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() regenerate?: boolean;
}

export class CreateManualQuestionDto {
  @IsString() competitionId!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() candidateId?: string;

  @Type(() => Number) @IsInt() @Min(1) startVerseId!: number;

  @IsIn(AMOUNT_UNITS, { message: "وحدة المقدار غير معروفة" })
  amountUnit!: (typeof AMOUNT_UNITS)[number];

  @Type(() => Number) @IsInt() @Min(1) amountValue!: number;
}
