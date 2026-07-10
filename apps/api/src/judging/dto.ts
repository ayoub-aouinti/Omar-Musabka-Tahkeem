import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class QuestionTallyDto {
  @IsString() questionId!: string;
  @Type(() => Number) @IsInt() @Min(0) talathumCount!: number;
  @Type(() => Number) @IsInt() @Min(0) tanbihCount!: number;
  @Type(() => Number) @IsInt() @Min(0) fathCount!: number;
  @Type(() => Boolean) @IsBoolean() cancelled!: boolean;
  /** اعتماد تقييم السؤال (true) vs حفظ كمسودّة (false). */
  @IsOptional() @Type(() => Boolean) @IsBoolean() confirmed?: boolean;
}

export class CriterionScoreDto {
  @IsString() criterionId!: string;
  @Type(() => Number) @IsNumber() @Min(0) value!: number;
}

export class SubmitScoresDto {
  @IsString() sessionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionTallyDto)
  questions!: QuestionTallyDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  criterionScores!: CriterionScoreDto[];

  @IsOptional() @IsString() notes?: string;

  /** `false` saves a draft; `true` submits and locks the result. */
  @Type(() => Boolean)
  @IsBoolean()
  finalize!: boolean;
}
