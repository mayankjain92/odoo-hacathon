import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateAssetDto {
  @ApiProperty({ example: "MacBook Pro 14" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: "Asset category id" })
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional({ example: "SN-ABC-001" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @ApiProperty({ example: "2026-01-15" })
  @IsDateString()
  acquisitionDate!: string;

  @ApiPropertyOptional({ example: 1499.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acquisitionCost?: number;

  @ApiPropertyOptional({ example: "Good" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  condition?: string;

  @ApiPropertyOptional({ example: "Floor 2 / Desk 14" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSharedBookable?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl()
  photoUrl?: string | null;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
