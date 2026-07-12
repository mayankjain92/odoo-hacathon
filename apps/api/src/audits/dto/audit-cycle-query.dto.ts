import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class AuditCycleQueryDto {
  @ApiPropertyOptional({ description: "Page number (1-indexed)", default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "Number of items per page", default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "Filter by status" })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: "Filter by Department ID" })
  @IsString()
  @IsOptional()
  departmentId?: string;
}
