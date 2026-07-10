import { Gender } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateJudgeDto {
  @IsString() @MinLength(2) fullName!: string;
  @IsEnum(Gender) gender!: Gender;
  @IsOptional() @IsString() residence?: string;
  @IsOptional() @Type(() => Number) @IsInt() externalNo?: number;
}

export class UpdateJudgeDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() residence?: string;
}

export class IssueAccessDto {
  @IsString() competitionId!: string;

  /** The dashboard offers 4, 8 and 24 hours. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72, { message: "أقصى مدة للجلسة المؤقتة 72 ساعة" })
  hours!: number;
}
