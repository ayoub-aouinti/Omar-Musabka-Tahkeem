import { Gender } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class ListCandidatesDto {
  @IsOptional() @IsString() competitionId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() take?: number;
  @IsOptional() @Type(() => Number) @IsInt() skip?: number;
}

export class CreateCandidateDto {
  @IsString() competitionId!: string;
  @IsString() categoryId!: string;
  @IsOptional() @Type(() => Number) @IsInt() externalId?: number;
  @IsString() @MinLength(2) fullName!: string;
  @IsEnum(Gender) gender!: Gender;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() teacherName?: string;

  /** Free text, e.g. «من مريم إلى النّاس». Parsed server-side. */
  @IsString() @MinLength(3) scopeRaw!: string;
}

export class UpdateCandidateDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() teacherName?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() scopeRaw?: string;
}

export class SetJudgesDto {
  @IsArray()
  @IsString({ each: true })
  judgeIds!: string[];
}

export class AssignJudgeDto {
  @IsArray()
  @IsString({ each: true })
  judgeIds!: string[];

  @IsArray()
  @IsString({ each: true })
  candidateIds!: string[];
}
