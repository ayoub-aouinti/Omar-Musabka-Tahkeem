import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CompetitionStatus, CriterionKind, PenaltyKind } from "@prisma/client";

export class BandDto {
  @IsNumber() @Min(0) minPoints!: number;
  @IsNumber() @Min(0) maxPoints!: number;
  @IsString() descriptionAr!: string;
}

export class ScaleDto {
  @IsString() labelAr!: string;
  @IsInt() @Min(1) minHizb!: number;
  @IsInt() @Min(1) maxHizb!: number;
  @IsNumber() @Min(0) maxPoints!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BandDto)
  bands?: BandDto[];
}

export class CriterionDto {
  @IsString() key!: string;
  @IsString() labelAr!: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsEnum(CriterionKind) kind!: CriterionKind;
  @IsNumber() @Min(0) maxPoints!: number;
  @IsOptional() @IsInt() sortOrder?: number;

  /** Per-category scales (with descriptive bands). Optional. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScaleDto)
  scales?: ScaleDto[];
}

export class PenaltyRuleDto {
  @IsEnum(PenaltyKind) kind!: PenaltyKind;
  @IsString() labelAr!: string;
  @IsNumber() @Min(0) weight!: number;
}

export class CreateCompetitionDto {
  @IsString() @MinLength(3) name!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria?: CriterionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PenaltyRuleDto)
  penaltyRules?: PenaltyRuleDto[];
}

export class UpdateCompetitionDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEnum(CompetitionStatus) status?: CompetitionStatus;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
}

/** Replaces the whole scoring configuration in one transaction. */
export class UpdateScoringDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria!: CriterionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PenaltyRuleDto)
  penaltyRules!: PenaltyRuleDto[];
}

export class UpsertCategoryDto {
  @IsInt() @Min(1) hizbCount!: number;
  @IsString() labelAr!: string;
  @IsInt() @Min(1) questionCount!: number;
  @IsString() amountUnit!: string;
  @IsInt() @Min(1) amountValue!: number;
}

/** Replaces the full judge panel seated on a category (the group default). */
export class SetCategoryJudgesDto {
  @IsArray()
  @IsString({ each: true })
  judgeIds!: string[];
}
