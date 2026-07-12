import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsArray, IsDateString } from "class-validator";

export class CreateAuditCycleDto {
  @ApiProperty({ description: "Name of the audit cycle", example: "Q3 2026 Hardware Audit" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: "Optional Department ID scope (cuid)" })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: "Optional Location scope" })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ description: "Start date of the audit cycle", example: "2026-07-01T00:00:00Z" })
  @IsDateString()
  @IsNotEmpty()
  startsAt!: string;

  @ApiProperty({ description: "End date of the audit cycle", example: "2026-07-31T23:59:59Z" })
  @IsDateString()
  @IsNotEmpty()
  endsAt!: string;

  @ApiPropertyOptional({ description: "Array of user IDs (cuid) who will be auditors", type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  auditorIds?: string[];
}
